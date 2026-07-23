# Plan — Match re-notification engine (ships disabled, dry-run first)

Every Monday, re-notify partnerships that have released matches and whose members
have **never logged in** — until they log in. SMS+email where a phone exists, email
only otherwise. Ships behind `RENOTIFY_ENABLED=false` (dry-run). No live sends this PR.

## GATE CLEARED — login-event source verified (the feature keys on this)
The spec guessed `system_events`; **that is wrong**. There is **no login event_type**
in `system_events` (live tally: only match_compute / notification_sent / match_release /
sms_notify / notify_run / market_live_toggled) and no app code writes one. The real,
reliable signal is **Supabase-native `auth.users.last_sign_in_at`**, set on session
creation by the magic-link handlers (`/auth/confirm` `verifyOtp`, `/auth/callback`
`exchangeCodeForSession`). Live read: **629 auth users, 42 logged-in-ever, 587 never**,
`last_sign_in_at` populated back to 2025-12. Signal is present and trustworthy → **proceed**
(no STOP). "Never logged in" = every member's `last_sign_in_at IS NULL`.

## Audience — live read (funnel), and a timing caveat
Predicate (partnership unit): **`release_at <= now`** (released — the notify pipeline's
own definition, `app/api/cron/notify-matches/route.ts:67`) **AND** `sms_notified_at IS NOT
NULL` on a released row (already notified ≥ once — the durable "notified" marker that
**survives the weekly recompute**; the upsert overwrites `release_at` but not
`sms_notified_at`) **AND** no member has `last_sign_in_at` **AND** live-market **AND** not
suppressed. This cleanly partitions from the existing flow, which owns `sms_notified_at IS
NULL` (never-notified) — **no double-cover**.

| Funnel (2026-07-23) | count |
|---|---:|
| notified-once (`sms_notified_at` ever set) | 99 |
| ∩ live-market | 79 |
| ∩ never-logged-in → **projected Monday audience** | **53** |
| — has phone (SMS+email) | **0** |
| — no phone (email only) | **53** |
| excluded because a member logged in | 26 |

**Timing caveat (flag):** run *today* (Thu) the released set is only 6 partnerships → audience
**2**, because the last recompute pushed `release_at` to **2026-07-27** (next Monday) for 370
of 378 rows (pending, not released). The job runs **Monday after the notify cron**, when those
re-release → audience ≈ **53**. Both numbers are real; the 53 is the operative one. The dry-run
should be triggered **on a Monday** (manual admin trigger provided) for Raunek's exact review.
**All 53 are email-only** (pre-webhook cohort's phones were destroyed) — the SMS path is built
but exercises 0 users today; expected per the spec.

## Cron timing map (real sequence — no changes to existing crons)
`vercel.json` is source of truth: **recompute `0 12 * * 1`**, **notify `0 14 * * 1`** (UTC).
The "8 AM ET vs 7 AM ET" discrepancy is **just DST**: 12:00 UTC = 8:00 EDT (summer) / 7:00 EST
(winter); not a config bug. New: **re-notify `0 16 * * 1`** (16:00 UTC Monday) — 2 h after notify
(notify maxDuration 5 min), safe gap. Sequence: recompute → notify-new → **re-notify**.

## Files
- **Migration `047_renotify_log.sql`** — audit + suppression + dashboard source:
  `renotify_log(id, partnership_id, run_date date, dry_run bool, variant text, channels_attempted text[], sms_status text, email_status text, suppressed_reason text, send_count int, created_at)`,
  **UNIQUE (partnership_id, run_date)** → a re-run of the same Monday cannot double-send
  (idempotency). Promote-only audit (never deleted/rewritten). RLS on, service-role only.
- **`lib/renotify/copy.ts`** — SMS + email copy, two variants (`has_phone`, `no_phone`;
  the no-phone email asks them to add a phone for future match texts). No match names
  (client rejected). Short, branded to existing templates. Constants for easy edit.
- **`lib/renotify/audience.ts`** — the eligibility query (pure predicate helpers +
  the batched reads: computed_matches, partnership_members, partnerships, `listUsers`
  snapshot for login, market index). Exported pure fns for tests.
- **`lib/renotify/runReNotify.ts`** — orchestrator: snapshot login at job start (=
  send-time, single Monday run), build audience, per-partnership resolve variant/channel,
  **re-check suppression at send time**, then dry-run-log OR send-and-log. **Reuses**
  `sendSMS`/`sendEmail`/`buildSignInUrl` (the existing provider wrappers) — does **not**
  fork or touch `notifications.ts`/the notify flow. Dry-run calls **no** providers.
- **`app/api/cron/renotify/route.ts`** — `CRON_SECRET` Bearer gate, `0 16 * * 1`.
- **`app/api/admin/renotify/route.ts`** — allowlist-gated: `GET` = latest run summary;
  `POST` = manual trigger (respects `RENOTIFY_ENABLED`; POST forces a dry-run run for review).
- **`vercel.json`** — one cron line.

## Suppression rules
1. **login_detected** — any member `last_sign_in_at` set, re-checked at send time (login
   snapshot taken at job start on Monday, so a Sunday-11pm login is already excluded).
2. **cap_reached** — `send_count >= MAX_RENOTIFY_SENDS` (const, default **8** consecutive
   weeks; counts prior non-dry-run sends in `renotify_log`). Logged with its own reason so
   the long-tail cohort is visible for a client decision. Cap does not delete history.
3. **unsubscribe/bounce** — **none exists today** (no unsub/bounce/suppression state in the
   schema or Resend wiring). Noted as a future hook; suppression = login + cap for now.

## Channel + copy
- **has_phone** → `sendSMS` (primary CTA) **and** `sendEmail` same day (client instruction).
- **no_phone** → `sendEmail` only, variant copy asks to add a phone.
- Magic sign-in CTA via `buildSignInUrl(email)` (per-user passwordless link). Never reveals matches.

## Dry-run (the flag)
`RENOTIFY_ENABLED` (default **false**). When false: full pipeline runs (audience → channel →
suppression) and writes `renotify_log` rows `dry_run=true` (counts + per-partnership
channel/variant, **IDs only, no PII**); **no provider calls**. Admin endpoint returns it.
First live enable is manual after Raunek reviews a Monday dry-run.

## Tests (`npx tsx`, repo convention)
Audience edges (login-Sunday exclusion, couple-one-logged-in exclusion, `release_at<=now`
vs pending, `sms_notified_at IS NULL` → not re-notify [never-notified stays existing flow]),
idempotency (same run_date → 0 sends), cap boundary (7→send, 8→suppress), channel selection
per phone state, **dry-run invokes no provider** (spy on injected sender).

## Acceptance mapping / guardrails
Ships `RENOTIFY_ENABLED=false`; no live sends; no PII (IDs only); promote-only audit;
existing notify flow files untouched (reuses provider wrappers only); off-hours deploy.
