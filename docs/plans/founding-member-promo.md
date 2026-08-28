# Founding Member promotion — recon + plan

**Status:** plan only. No code, no migrations, no copy changes. Base: `main` @ `bab90cc`.
**Recon date:** 2026-08-28. All figures are live-DB counts taken during recon.

The client wants eligible members in active markets to receive a complimentary
6-month HAEVN+ membership, presented as a **Founding Member** thank-you. Paid
checkout is unavailable; this is a promotion, and nothing member-facing may
reference payment availability.

---

## 0. The one thing to settle first

**`membership_tier` is a single column — but nobody has proven which values it accepts.**

`supabase/migrations/001_init.sql:10` declares `CREATE TYPE membership_tier AS ENUM ('free','plus','select')`. But
`043_markets_release_gating.sql` records that **001 was never fully applied to this
database** ("city_status, also from 001, is absent"). A non-mutating probe (zero-row
`UPDATE`) accepted `'zzz_not_a_tier'`, which an enum cast would have rejected at plan
time — so **the live column is TEXT, not that enum**. Whether a CHECK constraint
restricts it is *not* observable without a real write.

This matters more than anything else in this document: the Lemon Squeezy webhook
writes `membership_tier: 'plus'`
([`app/api/lemonsqueezy/webhook/route.ts:101`](../../app/api/lemonsqueezy/webhook/route.ts)),
and the live table contains **only `'free'` and `'pro'`** — zero `'plus'` rows. If a
CHECK allows only `('free','pro')`, the promo activation will fail exactly the way
paid upgrades fail today.

**Run before the build starts:**

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'partnerships'::regclass and contype = 'c';

select column_name, data_type, udt_name, column_default
from information_schema.columns
where table_name = 'partnerships' and column_name = 'membership_tier';
```

The answer decides whether the build writes `'plus'` (and fixes the constraint) or
writes `'pro'` (and defers canonicalization). **Do not start the build without it.**

---

## 1. Tier storage and the predicate

**Single source of truth: `partnerships.membership_tier`.** No second tier column
exists — `profiles` has no tier field. Good news: nothing to reconcile.

Live distribution (798 partnerships):

| tier | count |
| --- | --- |
| `free` | 794 |
| `pro` | 4 |
| `plus` | **0** |

**`'plus'` canonicalization has not happened.** The code says `plus`, the data says
`pro`.

**Two readers, both tolerant:**

| Reader | File | Behaviour |
| --- | --- | --- |
| `getUserMembershipTier()` | [`lib/actions/dashboard.ts:70`](../../lib/actions/dashboard.ts) | Reads the partnership via `partnership_members`, prefers the owner row, normalises **any non-`free` value** to `'plus'`. |
| `canAccessConnection()` | [`lib/connections/canAccessConnection.ts`](../../lib/connections/canAccessConnection.ts) | The single reveal/messaging gate. Any non-`free` tier grants access; **enforces `membership_expires_at` at read time**, failing open on an unparseable date. |

Because both normalise, **the promo works whichever string we write** — but the
string must be chosen deliberately, not by accident.

**Expiry model already exists.** `partnerships.membership_expires_at` (migration 040),
enforced in three places:
- read-time in `canAccessConnection()`,
- read-time in [`lib/partnership/membershipExpiry.ts`](../../lib/partnership/membershipExpiry.ts) (`isMembershipExpired`, deliberately queried in isolation so a missing column degrades safely),
- a daily cron, [`/api/cron/downgrade-expired`](../../app/api/cron/downgrade-expired/route.ts) (06:00 UTC, `vercel.json`).

**So expiry is not a gap — it is already built and enforced.** Only **3 of the 4**
paid partnerships have a date set.

**How a paid upgrade writes today** (the shape to mirror, minus payment): the webhook
computes months from the plan, sets `membership_tier` + `membership_expires_at` on
`partnerships`, then inserts a `purchases` row. **The promo must not write a
`purchases` row** — no payment record, no fake transaction.

---

## 2. Every upgrade CTA

**22 member-facing call sites. Every one routes to `/onboarding/membership`.** After
PRs #28/#29 the labels come from
[`lib/matches/membershipCopy.ts`](../../lib/matches/membershipCopy.ts), so copy is
already centralised even though routing is not.

| # | File:line | Surface |
| --- | --- | --- |
| 1 | [`app/dashboard/matches/[id]/breakdown/page.tsx:179`](../../app/dashboard/matches/[id]/breakdown/page.tsx) | Breakdown gate (sticky bar) |
| 2–3 | [`app/dashboard/matches/[id]/page.tsx:367,435`](../../app/dashboard/matches/[id]/page.tsx) | Match detail: inline + upgrade block |
| 4 | [`app/dashboard/matches/page.tsx:263`](../../app/dashboard/matches/page.tsx) | Matches list |
| 5 | [`app/dashboard/recommendations/page.tsx:147`](../../app/dashboard/recommendations/page.tsx) | Recommendations |
| 6 | [`app/dashboard/nudges/page.tsx:178`](../../app/dashboard/nudges/page.tsx) | Nudges |
| 7 | [`app/connections/[id]/page.tsx:75`](../../app/connections/[id]/page.tsx) | Connection detail |
| 8–9 | [`app/profiles/[id]/page.tsx:102,232`](../../app/profiles/[id]/page.tsx) | Profile view: guard + CTA |
| 10 | [`app/profile/page.tsx:383`](../../app/profile/page.tsx) | Own profile / plan row |
| 11 | [`app/discovery/page.tsx:72`](../../app/discovery/page.tsx) | Discovery |
| 12 | [`app/chat/page.tsx:43`](../../app/chat/page.tsx) | Chat index guard |
| 13 | [`app/chat/[connectionId]/page.tsx:80`](../../app/chat/[connectionId]/page.tsx) | Chat thread guard |
| 14 | [`app/messages/page.tsx:108`](../../app/messages/page.tsx) | Messages |
| 15 | [`app/matches/[matchId]/page.tsx:452`](../../app/matches/[matchId]/page.tsx) | Legacy match detail |
| 16 | [`app/onboarding/celebration/page.tsx:26`](../../app/onboarding/celebration/page.tsx) | Onboarding celebration |
| 17 | [`components/dashboard/UpgradeBar.tsx:68`](../../components/dashboard/UpgradeBar.tsx) | Persistent upgrade bar |
| 18–19 | [`components/dashboard/DashboardNavigation.tsx:81,82`](../../components/dashboard/DashboardNavigation.tsx) | Nav item |
| 20–21 | [`components/dashboard/ProfileCard.tsx:426,435`](../../components/dashboard/ProfileCard.tsx) | Rec/connection card |
| 22 | [`components/dashboard/MatchesSection.tsx:242`](../../components/dashboard/MatchesSection.tsx) | Dashboard matches section |

**No CTA carries a source or attribution parameter today.** Attribution has to be added.

**Exceptions — routed there but NOT upgrade intent** (must not be treated as CTA clicks,
and must not be redirected into the promo):

| File:line | Why |
| --- | --- |
| [`lib/db/onboarding.ts:32`](../../lib/db/onboarding.ts) (step 9) | Onboarding step ordering |
| [`lib/onboarding/flow.ts:59`](../../lib/onboarding/flow.ts) | Server resume-step controller |
| [`lib/onboarding/client-flow.ts:65`](../../lib/onboarding/client-flow.ts) | Client resume-step controller |

A member mid-onboarding is sent to `/onboarding/membership` as a *step*, not because
they asked to upgrade. The choke point must distinguish these (see §3).

---

## 3. Routing — the choke point

**Confirmed: `/onboarding/membership` is a true single choke point for all 22 CTAs.**
No CTA needs to change. That is the whole design.

**Proposal — a server-side decision ahead of the existing page.**
`app/onboarding/membership/page.tsx` is a **client component** (`'use client'`), so the
decision cannot live inside it without a refactor. Instead:

- Add `app/onboarding/membership/layout.tsx` (or convert the route to a server page
  that renders the existing client component as a child). The server layer reads:
  1. the promo config (§7),
  2. the viewer's partnership tier,
  3. the viewer's resolved market (§4),
  4. whether they already activated,
  and either `redirect()`s to `/founding-member` or renders the existing paid page
  untouched.

- **Attribution without touching 22 files:** the redirect preserves `?src=` when
  present, and the CTA-click event (§6) is emitted from the choke point using the
  `referer` header as the fallback source. Adding an explicit `?src=` to each CTA is a
  *nice-to-have second pass*, not a blocker — the referer covers every surface on day
  one and keeps this PR's diff small.

- **Onboarding traffic is excluded** by checking whether the member's resume step *is*
  the membership step. Those users see the existing page.

**Kill switch:** config `enabled = false` → the layer is a pass-through and every CTA
lands on the existing paid page. **One value, global, no deploy** (see §7).

---

## 4. Market — the biggest gap in the plan

**Resolution chain already exists and is proven:**
`partnerships.city` → `msa_allowed_zips.city` → `msa_name` → `markets.is_live`,
implemented in [`lib/markets/releaseGate.ts`](../../lib/markets/releaseGate.ts)
(`loadMarketIndex`, `resolveMarket`, `isCityLive`) and reused by
[`lib/metrics/scope.ts`](../../lib/metrics/scope.ts). **Reuse it — do not write a
second resolver, and never hardcode "Austin"/"Portland" strings.**

**The gap:** the market model only knows Austin.

- `markets` has **exactly one row**: `Austin–Round Rock MSA`, `is_live = true`.
- `msa_allowed_zips` covers **24 cities, all Austin metro** (81 zip rows).
- `partnerships.city` is free text, **0 NULLs**, ~100 distinct values.
- **455 of 798 partnerships resolve to a known MSA city. 343 do not** and today fail
  closed.

Top unresolved cities:

| city | partnerships |
| --- | --- |
| Portland | 65 |
| Salem | 12 |
| Beaverton | 10 |
| Vancouver | 10 |
| San Antonio | 7 |
| Hillsboro | 7 |
| Tampa | 6 |
| Eugene | 6 |
| Houston | 5 |

**Portland is not representable today.** There is no Portland MSA city list and no
Portland `markets` row. The client's "Austin and Portland" cannot be honoured until
someone defines the Portland metro city list the way they defined Austin's 24.

**Build implication:** seeding `msa_allowed_zips` with a client-approved Portland city
list plus a `markets` row is a **prerequisite**, not a detail. It needs the client's
boundary decision (does Vancouver WA count? Salem? Eugene?) — the same judgement they
made for Austin–Round Rock.

**Proposed default for non-market members:** they see the **existing paid page**,
unchanged. Not an error, not an apology, no mention of payment. Flagged as a client
decision (§11) because the alternative — showing everyone the promo — is a real option
the client may prefer.

---

## 5. Schema

**Extend `partnerships`.** The membership record is already a set of columns on that
row (`membership_tier`, `membership_expires_at`), both readers read it, and the expiry
cron updates it. A separate table would create a second source of truth for the exact
thing §1 says we must keep singular.

```sql
-- 055_founding_member_promo.sql  (SKETCH — additive, all nullable)
ALTER TABLE partnerships
  -- 'founding_member_promo' | 'paid'. NULL = pre-dates this migration.
  ADD COLUMN IF NOT EXISTS plus_source      TEXT,
  -- when HAEVN+ actually began (membership_expires_at already holds the end).
  ADD COLUMN IF NOT EXISTS plus_activated_at TIMESTAMPTZ,
  -- resolved market at activation time, for reporting. Never a hardcoded literal.
  ADD COLUMN IF NOT EXISTS promo_market     TEXT,
  -- which CTA sent them, for the client's attribution question.
  ADD COLUMN IF NOT EXISTS promo_cta_source TEXT;

CREATE INDEX IF NOT EXISTS idx_partnerships_plus_source
  ON partnerships (plus_source) WHERE plus_source IS NOT NULL;
```

Notes:
- **`plus_expires_at` is deliberately NOT added.** `membership_expires_at` already
  exists, is already enforced in three places, and is what the downgrade cron reads.
  Adding a parallel column would split the expiry model in two.
- The four existing paid rows get `plus_source = NULL`. A **backfill to `'paid'` is
  optional** and should be a separate, explicit statement — not folded into this
  migration.
- **No `purchases` row, no order id, no amount.** The promo is not a transaction.

---

## 6. Analytics

**There is no upgrade-intent tracking today. None.** `system_events` holds
`match_compute` (999 rows) and one `console_recompute_snapshot`. Every one of the 22
CTAs is currently unmeasured.

`system_events` shape: `id, event_type, triggered_by, partnership_id, metadata, created_at`.
`metadata` is JSON — enough for attribution without a schema change. **Reuse it.**

| event | when | `metadata` |
| --- | --- | --- |
| `upgrade_cta_clicked` | choke point, every arrival with upgrade intent | `{ src, path, tier, market, promo_eligible }` |
| `founding_offer_viewed` | `/founding-member` renders for an eligible member | `{ src, market, term_months }` |
| `founding_activation_completed` | activation succeeds | `{ src, market, term_months, expires_at }` |

`partnership_id` is a first-class column — use it, and keep member identity out of
`metadata`. **The client's two numbers** — CTA clicks and activations — are then
`count(*)` per `event_type`, with `src` giving the per-surface breakdown.

Emit all three **server-side** from the choke point and the activation action, not from
the browser: client-side emission would be lost to ad blockers and is not verifiable.

---

## 7. Flag design

Existing pattern: [`lib/feature-flags.ts`](../../lib/feature-flags.ts) — a single
`FEATURE_FLAGS` object read from env, currently one entry (`requireVerification`).

Env alone is **not** sufficient here: per-market enablement and a configurable term are
values the client will want to change without a deploy, and a market list in an env var
would drift from the `markets` table.

**Proposal — env kill switch + a config row:**

```
FOUNDING_PROMO_ENABLED = 'true' | 'false'     # env, server-only. Global kill switch.
```

plus a single JSON config row in the existing `markets`-adjacent style:

```sql
-- one row, id = 'founding_member_promo'
CREATE TABLE IF NOT EXISTS promo_config (
  id          TEXT PRIMARY KEY,
  config      JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- config: { "enabled": true, "markets": ["Austin–Round Rock MSA"], "term_months": 6 }
```

- **`markets` entries must be exact `markets.market_name` values**, read from the table
  — never literals typed into config by hand (the Austin name contains an EN-DASH,
  U+2013; migration 043 calls this out explicitly).
- **Kill switch behaviour:** `FOUNDING_PROMO_ENABLED=false` wins over the config row
  and restores paid routing globally, with no DB write and no deploy of app code.
- **Mid-flow disable:** a member already redirected to `/founding-member` who submits
  after the flag flips gets a graceful "this offer has ended" state and is **not**
  activated. The activation action re-checks the flag; the landing page render is not
  the authority.

---

## 8. Downstream surfaces

What changes the moment a free member becomes non-`free`:

| Surface | Gate | Ready? |
| --- | --- | --- |
| Match card identity (name, photo) | server-side redaction, [`lib/matches/redactMatchCard.ts`](../../lib/matches/redactMatchCard.ts) | ✅ ready, tested (29 assertions) |
| Breakdown identity panel | same redaction path | ✅ ready |
| Recommendation / connection reveal | `canAccessConnection()` | ✅ ready, tested (51 assertions) |
| Nudge sending | `lib/actions/nudges.ts:316` reads `membership_tier` | ✅ ready |
| Photo visibility | `PhotoGrid` + redaction | ✅ ready |
| **Messaging / chat** | tier only — `app/chat/page.tsx:37`, `app/chat/[connectionId]/page.tsx:74`, `app/messages/page.tsx` | ⚠️ **no independent flag** |

**Messaging has no flag of its own.** Granting HAEVN+ opens chat immediately for every
activated member. Per the decision rules, **adding one is in the build scope**:

```
MESSAGING_ENABLED = 'true' | 'false'   # env, server-only
```

checked at the two chat route guards, the messages page, and the send action — so
messaging can stay closed independently of tier while the client's underwriting is
open. A member who gains HAEVN+ with messaging off should see the connection revealed
and a neutral "messaging is coming soon" state, **never** anything about payments.

---

## 9. Expiry

**Nothing new is needed to store the date correctly.** `membership_expires_at` already
exists, is enforced at read time in two predicates, and is swept daily by
`/api/cron/downgrade-expired`.

The promo activation must set it to `now + term_months` — exactly what the webhook does
at [`route.ts:93-95`](../../app/api/lemonsqueezy/webhook/route.ts). With
`plus_source = 'founding_member_promo'` and `plus_activated_at` recorded alongside, the
expiration flow from the client's Jul 23 spec (warning emails, win-back, conversion to
paid) can be built later **with no migration** — every field it needs will already be
populated.

One caveat worth stating: at 6 months these members will silently drop to free via the
existing cron. That is correct behaviour, but the client should decide the
communication plan *before* the first cohort expires, not after.

---

## 10. Protecting existing paid members

Four partnerships hold `'pro'`. The promo must never touch them.

1. **Eligibility is `membership_tier = 'free'` and nothing else.** Any non-free tier is
   ineligible — the same tolerant test both existing predicates already use.
2. **The activation write is conditional**, not a blind update:
   `... WHERE id = $1 AND membership_tier = 'free'` — so a race, a double submit, or a
   stale CTA cannot overwrite a paid membership or its expiry.
3. **A paid member who clicks a stale CTA** falls through the choke point to the
   existing page. They never see the promo.
4. **Re-entry is idempotent:** a member who already activated
   (`plus_source = 'founding_member_promo'`) sees the confirmation state, and the
   conditional write makes re-activation a no-op that cannot extend their own term.

---

## 11. Client decisions needed

1. **Portland.** It cannot be gated today — no Portland city list, no `markets` row.
   The client must supply the Portland metro city list (as they did Austin's 24), and
   decide whether Vancouver WA, Salem, Hillsboro, Beaverton and Eugene are in or out.
   **Blocking for Portland; Austin can ship without it.**
2. **Members outside a live market** (343 of 798 today). Proposed default: they see the
   existing paid page. Alternative: extend the promo network-wide. Client's call.
3. **Messaging on or off at launch.** Proposed: ship the flag, launch with messaging
   **off**, flip separately.
4. **Tier string.** Pending the §0 constraint check: write `'plus'` (and fix the
   constraint in the same PR) or write `'pro'` (and defer canonicalization)?
5. **Term.** 6 months confirmed — configurable, but confirm 6 is the launch value.
6. **Backfill.** Should the 4 existing paid rows get `plus_source = 'paid'`, or stay
   NULL?
7. **Expiry communication.** What happens at month 6 — and who writes that copy?

---

## Build scope summary (one PR, flag off at deploy)

Additive migration (`partnerships` columns + `promo_config`) · choke-point server layer
at `/onboarding/membership` · `/founding-member` landing + activation action ·
three `system_events` emitters · `FOUNDING_PROMO_ENABLED` + `MESSAGING_ENABLED` flags ·
messaging gate at three call sites. **Prerequisite:** the §0 constraint answer, and the
Portland city list if Portland is in scope at launch.
