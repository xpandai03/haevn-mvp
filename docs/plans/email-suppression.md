# Plan — Email suppression (bounce / complaint / unsubscribe)

**Status:** PLAN ONLY — mandatory STOP for approval before building. Read-only recon done.
**Date:** 2026-08-04. **Goal:** by Aug 10's run, a bounce/complaint from Aug 3's cohort can never be re-mailed, members can opt out of nags without losing real match alerts, and the readout reports suppression alongside sends.

## 1. Recon findings

| Thing | Reality |
|---|---|
| Email send choke point | **`lib/services/email.ts` `sendEmail(to, subject, html)`** — the ONE place `resend.emails.send` is called. Both senders route through it. |
| Sender 1 (transactional) | `lib/services/notifications.ts` `sendNotification({type})` → `sendEmail`. Types: `match`, `message`, `connection_interest`. |
| Sender 2 (recurring) | `lib/renotify/runReNotify.ts` → injected `Sender.sendEmail` (= the same `sendEmail`). This is the campaign. |
| Magic links | `buildSignInUrl` generates a Supabase magic URL that is **embedded inside** match/renotify emails — there is no separate "magic-link email" through our stack. Supabase-native auth emails (signup/OTP) go through Supabase's own SMTP, **never through our `sendEmail`**, so they're structurally unsuppressable by us. ✅ the hard rule is satisfied by construction; we still add an explicit `critical` bypass as defense. |
| Existing suppression pattern | `renotify_log.suppressed_reason` already carries `'login_detected' \| 'cap_reached'` — we **extend** it with `'email_suppressed'` (additive), not a parallel system. |
| Env | `RESEND_API_KEY` set (prod, 124d). **No `RESEND_WEBHOOK_SECRET`**, no unsubscribe secret, no Resend webhook route. |
| Deps | `resend ^6.10.0` installed; **`svix` NOT installed**. Existing webhooks (lemonsqueezy, veriff) verify HMAC **manually** — we'll match that (manual Svix verify, no new dep). |

## 2. Resend event reality (verified against current docs, Aug 2026)

- Events: **`email.bounced`** = "recipient's mail server **permanently rejected**" (this IS the hard bounce), **`email.complained`** = "delivered, but recipient **marked as spam**." Envelope: `{ type, created_at, data }`; recipient in `data.to[]` (+ `data.bounce` details / `data.email_id`).
- **Resend runs its OWN suppression list** — it auto-adds hard-bouncers ("on the suppression list because it has a recent history of producing hard bounces"). So Resend already stops some re-sends upstream; **our layer still records every event for visibility + audience logic**, and gives us unsubscribe (which Resend's list does not).
- **Signature = Svix.** Headers `svix-id`, `svix-timestamp`, `svix-signature`. Secret `whsec_<base64>`. Verify: `sig = base64(HMAC_SHA256(base64decode(secret_after_prefix), \`${svix_id}.${svix_timestamp}.${rawBody}\`))`, constant-time-compared against each space-delimited `v1,<base64>` in `svix-signature`; reject if `svix-timestamp` is outside a tolerance (±5 min) [replay guard]. Raw body required.
- Soft/transient bounces: Resend's `email.bounced` is the *permanent* one. If a payload surfaces a transient/soft subtype (`data.bounce.type`), we **log, don't suppress** (policy §5).

Sources: [Resend event types](https://resend.com/docs/dashboard/webhooks/event-types), [Resend webhooks intro](https://resend.com/docs/dashboard/webhooks/introduction), [Resend verify webhooks](https://resend.com/docs/webhooks/verify-webhooks-requests), [Svix manual verification](https://docs.svix.com/receiving/verifying-payloads/how-manual).

## 3. Migration — `email_suppressions` (migration 051)

```sql
CREATE TABLE IF NOT EXISTS email_suppressions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,               -- ALWAYS stored lowercased
  reason      TEXT NOT NULL CHECK (reason IN ('hard_bounce','complaint','unsubscribe')),
  scope       TEXT NOT NULL CHECK (scope IN ('renotify','all_noncritical')),
  source      TEXT NOT NULL CHECK (source IN ('resend_webhook','unsub_link')),
  detail      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_email ON email_suppressions (lower(email));
ALTER TABLE email_suppressions ENABLE ROW LEVEL SECURITY;  -- service-role only, no policies
```

- **One row per email** (`UNIQUE`). Escalation via **upsert to the STRONGER scope** — `all_noncritical` (complaint) always wins over `renotify` (unsub/bounce); `reason`/`source`/`detail` update to the escalating event. **Never auto-removed.**
- Escalation rule (implemented in a pure `escalateScope(existing, incoming)`): `all_noncritical` > `renotify`. So unsub-then-complaint → `all_noncritical`; complaint-then-unsub → stays `all_noncritical`.

## 4. Webhook receiver — `app/api/webhooks/resend/route.ts`

- **Manual Svix verification** (§2), against `RESEND_WEBHOOK_SECRET`. Bad/absent/expired signature → **401, no DB write** (an unverified webhook writing suppressions = mass-silence attack surface — hard requirement). Uses `request.text()` for the raw body.
- Routing: `email.bounced` (permanent) → upsert `{reason:'hard_bounce', scope:'renotify', source:'resend_webhook'}`. `email.complained` → `{reason:'complaint', scope:'all_noncritical'}`. Anything else / transient bounce → 200 ack, log only, no suppression.
- **Idempotent on redelivery**: keyed on `email` (UNIQUE upsert); a repeat event is a no-op escalation. Optionally record `svix-id` in `detail` for audit.
- Recipient email lowercased before write. `detail` stores the (non-PII-beyond-the-address) event metadata: type, bounce subtype, email_id, svix-id, created_at.

## 5. Scope policy (the judgment call — default below, **flagged for client**)

| Send | Scope tag | Blocked by `renotify` suppression (bounce/unsub) | Blocked by `all_noncritical` (complaint) |
|---|---|:--:|:--:|
| **Re-notify weekly email** | `renotify` | ✅ | ✅ |
| **connection_interest** (rec-proceed nudge) | `all_noncritical` | ❌ | ✅ |
| **First match notification** (`type:'match'`) | `critical` | ❌ | ❌ |
| **message** notification | `critical` | ❌ | ❌ |
| **Magic-link sign-in** (embedded / Supabase-native) | `critical` | ❌ (never) | ❌ (never) |

Coverage: a `renotify` send is blocked if the email has **any** suppression (`renotify` OR `all_noncritical`); an `all_noncritical` send is blocked **only** by a `complaint`; a `critical` send is **never** blocked. Rationale: someone who bounced/unsubscribed shouldn't get weekly nags; a spam-complainer additionally loses nudge-style mail; but a real new match (and the sign-in link that lets them act on it) is the service working as signed up for.

**CLIENT FLAG (Q1):** should a **complaint** also suppress **new-match notifications**? Default = **no** (match stays critical). Some senders treat a spam complaint as "stop everything." Recommend keeping match critical (it's the core value + carries the sign-in link), but Rik decides.

## 6. Send-path guard (one choke point)

Extend `sendEmail(to, subject, html, opts?)` with `opts?: { scope?: 'renotify'|'all_noncritical'|'critical'; headers?: Record<string,string> }`, **default `scope:'critical'`** (magic-link-safe default — anything that doesn't opt in is never suppressed).

```
scope = opts?.scope ?? 'critical'
if (scope !== 'critical' && await isSuppressed(to, scope)) {
  return { success: false, error: 'suppressed', suppressed: true }   // logged, not sent
}
```
- `isSuppressed(email, sendScope)` (pure predicate over the row's scope): `renotify` send blocked if row scope ∈ {renotify, all_noncritical}; `all_noncritical` send blocked if row scope = all_noncritical.
- `sendNotification` maps `type` → scope: `connection_interest`→`all_noncritical`; `match`/`message`→`critical`.
- `runReNotify` passes `scope:'renotify'` + the List-Unsubscribe headers (§7).
- **Decision-rule note:** `sendEmail` is a genuine single choke point, so the guard lives there (not per-caller). Default-critical guarantees magic links and any un-tagged future sender are never suppressed.

## 7. Unsubscribe (footer link + RFC 8058 one-click)

- **Token** (no login, not forgeable, not enumerable): `token = base64url(email) + '.' + base64url(HMAC_SHA256(UNSUB_SECRET, \`${emailLower}:renotify\`))`. Scope baked in. HMAC over the address means you can't mint another address's token without the secret; idempotent (re-clicking re-writes the same row), so **no expiry / no invalidation needed**. New env **`UNSUBSCRIBE_SECRET`** (or reuse an existing app secret if you prefer fewer envs — flag).
- **Route `app/api/unsubscribe/route.ts`**: `GET ?token=` → verify → minimal landing page with a **Confirm** button; `POST` (from the button AND from `List-Unsubscribe-Post` one-click) → verify token → upsert suppression `{reason:'unsubscribe', scope:'renotify', source:'unsub_link'}` → plain confirmation page **stating match notifications continue**. Invalid token → neutral error page, no write.
- **Re-notify email changes** (only): footer line "Don't want these weekly nudges? Unsubscribe" (visible link → GET landing), **plus headers** on the send:
  - `List-Unsubscribe: <https://haevn.app/api/unsubscribe?token=…>, <mailto:unsubscribe@haevn.app>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
  (Gmail/Yahoo bulk-sender expectations.) Token generated per-recipient in `runReNotify`. **No unsub on transactional match/connection emails** (out of scope).

## 8. Audience exclusion + logging

- `buildAudience` loads the suppression set (emails suppressed for `renotify`) once, filters each partnership's `memberEmails`; if **none remain**, drop the partnership and surface it as suppressed. `runReNotify` writes a `renotify_log` row with **`suppressed_reason:'email_suppressed'`** for each dropped partnership (mirrors the existing `login_detected`/`cap_reached` logging), so it shows in the readout. (Partial: if some member emails remain, send to those.)
- Belt-and-suspenders: even if audience logic missed one, the §6 `sendEmail` guard blocks it at send.

## 9. Admin visibility

- `/api/admin/renotify` GET summary gains `suppressed.email_suppressed` count (alongside `login_detected`, `cap_reached`) + a cheap total `emailSuppressions: { total, byReason: {hard_bounce, complaint, unsubscribe} }`.
- No new dashboard UI this PR. (The Aug 10 watch item already asserts suppression appears in the readout.)

## 10. Tests
- **Svix verify**: valid sig → 200 + write; **bad sig → 401, ZERO writes**; stale timestamp → 401.
- **Event→scope mapping**: bounced→hard_bounce/renotify; complained→complaint/all_noncritical; transient/other→no suppression.
- **Escalation upsert** (pure `escalateScope`): unsub→complaint escalates to all_noncritical; complaint→unsub stays.
- **Suppression predicate** (`isSuppressed`): renotify send blocked by renotify-row AND by complaint-row; all_noncritical send blocked ONLY by complaint; **critical send never blocked** (magic-link/match bypass proven).
- **Audience exclusion**: suppressed email dropped, `email_suppressed` logged.
- **Unsub token**: valid round-trips; forged/tampered token rejected (no write); idempotent re-POST.
- **Webhook idempotency**: same event twice → one row, no error.

## 11. ⚠️ Manual step (needs Resend dashboard — I cannot do it)
Register the webhook in the Resend dashboard (or via their API if you give me a key with webhook scope):
- **Endpoint URL:** `https://haevn.app/api/webhooks/resend`
- **Events:** `email.bounced`, `email.complained` (optionally `email.delivery_delayed` for soft-bounce visibility).
- Copy the generated **signing secret** (`whsec_…`) into Vercel env `RESEND_WEBHOOK_SECRET` (Production + Preview), and set `UNSUBSCRIBE_SECRET`. Redeploy. Until the secret is set, the webhook route **fails closed** (401 → no writes) — safe.
I'll ship all code + the migration; this registration + the two env vars are the only manual actions, to be done in the same off-hours window.

## 12. Client questions (defaults built)
1. **Complaint → suppress new-match notifications too?** Default **no** (match stays critical). (§5)
2. **`UNSUBSCRIBE_SECRET`** as a new env, or reuse an existing secret? Default **new dedicated env**.
3. Unsubscribe **copy** — provisional footer + confirmation wording; Rik may reword (same as the connection_interest copy question).

## 13. Deliverable on approval
One PR: migration 051, `app/api/webhooks/resend/route.ts` (manual Svix verify), `email_suppressions` service + pure `escalateScope`/`isSuppressed`, `sendEmail` guard + `sendNotification`/`runReNotify` scope wiring, `app/api/unsubscribe` route + landing/confirm pages + List-Unsubscribe headers + footer, audience exclusion + `email_suppressed` logging, admin summary counts, tests. Off-hours deploy; webhook registration + envs in the same window.

---
### STOP — approval required before building.
Key decisions I need: **Q1 (complaint vs new-match)** and confirmation that the **manual Resend registration + two env vars** are acceptable as the only out-of-band steps. Everything else has a built default.
