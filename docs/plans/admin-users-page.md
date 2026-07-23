# Plan — /admin/users (member directory + audited impersonation side-door)

Third admin page. A searchable/filterable **card grid of members** (photo, status) + a
**gated, audited impersonation** flow to step into any account. Highest-privilege feature
in the product — allowlist + confirm + audit, always. Read-only otherwise.

## Schema pass (read-only, 2026-07-23)
- **Base table = `profiles`** (629 rows, 1:1 with auth users). Cols: `user_id, email,
  full_name, city, msa_status, survey_complete, profile_visible, created_at, verified…`.
  email + full_name populated on **all 629**; **`profiles.city` only 115** → **source the
  member's city from their partnership** (`partnerships.city`, populated), not profiles.city.
- Join shape: `profiles` ⋈ `auth.users.last_sign_in_at` (via the shared reader
  `lib/metrics/authLogins.ts`, PR #9 — **not** a third reader) ⋈ `partnership_members`
  → `partnerships` (tier, city, partner name, photos).
- **Photos**: `partnership_photos(photo_url, is_primary, is_banner, …)` — partnership-keyed.
  **Coverage: 28 partnerships have ≥1 photo → ~28 users → ~4% of the base.** Cards use an
  **initials avatar fallback**; **photo-coverage % in the header** (doubles as a data-quality view).
  A user's avatar = their partnership's `is_primary` photo. (photo_url format verified at build:
  full URL → used directly; storage path → public URL constructed.)
- **Tier**: `partnerships.membership_tier` (free 620 / pro 4) — partnership-level; TierBadge-style chip.
- **Survey status**: `user_survey_responses.completion_pct` (PR #7) — Complete (≥100) / In
  progress (1–99) / Not started (0/none).
- **Login**: 42/629 ever (`last_sign_in_at`).

## Impersonation side-door (the highest-privilege path — designed conservatively)
Mechanism is **already proven**: `admin.auth.admin.generateLink({ type:'magiclink', email })`
(re-notify's `buildSignInUrl`, PR #8) returns `https://www.haevn.app/auth/confirm?token_hash=…`
— server-side, **no email sent**, Supabase-default short TTL (NOT extended). No config change needed.

Flow (audit-FIRST, ordering is the guarantee):
1. Admin opens a member's detail panel → **"Sign in as user"**.
2. **Confirm dialog** states the audit policy + "opens in a separate browser — using it here signs YOU out."
   Optional **reason** field (captured for trust/safety).
3. `POST /api/admin/impersonate { targetUserId, reason? }` — **allowlist-gated**:
   - non-allowlisted → **403, and NOTHING is generated** (no link, no row).
   - allowlisted → resolve target email → **write `impersonation_log` row FIRST** (admin_email,
     target_user_id, reason, created_at) → **then** `generateLink` → return `{ link }`.
4. UI shows the link + **copy button** + **"open in an incognito / separate browser profile"**
   instruction. **Never** auto-navigates; **never** logs/persists the link server-side beyond the
   response; **never** emails it. Same-tab session juggling is explicitly out (v1).

`impersonation_log` (migration): `id, admin_email, target_user_id, reason (nullable), created_at`.
**Append-only**, service-role only (RLS on). Answers "who impersonated whom, when, why."

## Demographic filters (gender/orientation/intent) — DEFERRED (with reason)
These live in `answers_json`; per-user filtering means parsing JSON per row (the composition RPC
aggregates but can't filter cheaply per-user). **v1 defers them** to keep the page fast. **v1
search** = name / email / member-ID (box). **v1 filters** = survey status · login status · tier ·
market/city · has-photo. Demographic filters = a follow-up if wanted (would need an indexed
projection or the RPC extended to return per-user tags).

## API — `app/api/admin/users/route.ts` (GET, allowlist-gated, server-side)
Params: `search` (name/email/ID), `survey` (all|complete|in_progress|not_started), `login`
(all|ever|never), `tier` (all|free|pro), `market` (all|<name>|unresolved), `photo` (all|has|none),
`sort` (name|member_since|last_sign_in), `dir`, `page`, `pageSize` (default 48).
Batched (no N+1): profiles + `getLastSignInMap` + members→partnerships + primary photos +
completion_pct + market index → `UserCard[]`; filter/sort/paginate in TS (629 rows; fine at 10×).
Returns `{ rows, total, page, pageSize, summary: { total, withPhoto, completedSurvey, loggedInEver } }`.
```ts
UserCard = { userId, name, email, memberSince, city, market, tier, partnerName|null,
  surveyStatus:'complete'|'in_progress'|'not_started', completionPct, lastSignInAt|null,
  photoUrl|null, initials, partnershipId }
```

## Page — `/admin/users` (under AdminShell, active="users")
Thin gated page → `UsersClient` → API. **Header counts:** total members · % with photos · %
completed survey · % ever logged in. Filter bar + search. **Card grid** (avatar/initials, name,
email, city/market, tier badge, survey chip, "Never logged in" indicator, member since, partner
link for couples). Click → **Sheet detail panel**: fuller profile, partnership info, survey %,
last sign-in, notification history (`renotify_log` by partnership — cheap), and the **impersonation
action**. Pagination. Empty/loading/error states.

## Sidebar (AdminShell — same multi-page pattern as Matches)
`users` nav item gains `href:'/admin/users'` (flip SOON→active); `NavKey` += `'users'`;
`deriveActive` handles `/admin/users`. Route group `(network)` now serves 3 pages.

## PII stance
This is a deliberate step UP from Matches: full names, emails, photos — a directory for two
allowlisted admins. Guardrails: page + API allowlist-gated; **no PII in server logs**; **no PII in
the PR**; impersonation is the audited action; **no generated link in any log**.

## Tests
Search/filter building (survey/login/tier/market/photo), avatar-initials fallback, survey-status
derivation, pagination; **impersonation route**: audit row written BEFORE link returned ·
non-allowlisted → 403 with NO link generated · link never appears in log output (spy).

## Guardrails
Impersonation = allowlist + confirm + audit, no exceptions. No links in logs/PR. Append-only audit.
Read-only directory. No user editing, no messaging tools, no CTA changes, no email sends, no TTL
changes, no same-tab session juggling. Off-hours deploy.
