# Impersonation "expired link" — diagnosis, 2026-08-25/26

## Symptom

Every impersonation link the client generated showed "expired" on first open, in
a Chrome guest profile and in an incognito window, seconds after generation.

## Cause

**The single-use Supabase magic link was redeemed by an automated GET roughly
two seconds after it was generated.** The human's click was always the *second*
open, and Supabase correctly answered "Email link is invalid or has expired".

The consumer is outside our code — a link scanner, security extension, or
unfurl in the admin's browser or network path. Our page never fetched the link
(it rendered it into a read-only `<input>`). It did not affect Raunek's machine.

## Evidence

`impersonation_log.created_at` (written *before* the link is generated) against
`auth.users.last_sign_in_at` (moves only on a successful redemption):

| target | log `created_at` | `last_sign_in_at` | delta |
| --- | --- | --- | --- |
| `7384403f` | 2026-08-25 18:22:34.912Z | 18:22:37.431Z | **+2.5s** |
| `2f43a5be` | 2026-08-25 18:23:39.352Z | 18:23:41.002Z | **+1.6s** |
| `daa9bdc1` | 2026-08-26 13:04:41.947Z | 13:04:44.632Z | **+2.7s** |
| `cba7bdb2` | 2026-08-26 13:05:43.736Z | 13:05:45.996Z | **+2.3s** |

Four events across two days, all 1.6–2.7s. Not human speed.

Isolation probe on a throwaway auth user (created, probed, deleted):

- `generateLink` alone left `last_sign_in_at` at `null` — so those timestamps
  are genuine redemptions, not an artefact of generating the link.
- Cookie-free `fetch` of the link after a **60-second** delay:
  `307 → /onboarding/expectations`, `Set-Cookie: sb-haevn-auth`. Healthy.
- Second fetch of the same link:
  `307 → /auth/login?error=otp_verify&reason=Email%20link%20is%20invalid%20or%20has%20expired`
  — the reported symptom, reproduced exactly.

### Ruled out

| Hypothesis | Verdict |
| --- | --- |
| TTL shorter than the copy-paste gap | **No** — a 60s-old link redeemed cleanly. |
| Apex `haevn.app` redirect dropping the token | **No** — links are born on `www` (`notifications.ts`). |
| Session cookie set for an unreadable domain | **No** — `sb-haevn-auth` was set and accepted with no prior cookies. |
| Supabase OTP verified by the generating request | **No** — isolation probe above. |
| "expired" is a generic catch-all | **Not the cause**, but real and fixed: `/auth/login` had no branch for `otp_verify`/`otp_no_session` at all, so the client saw a blank login form and the only "expired" was in the address bar. |

Also worth recording: **the audit table contains no rows for Raunek, ever.** All
13 rows belong to the client's admin account. "It works for Raunek" was never
corroborated by the audit trail.

## Fix

Generation no longer produces a credential. It produces an opaque 256-bit
handoff token whose landing page is a plain GET that consumes nothing. The magic
link is created server-side only on an explicit POST and lives for exactly one
redirect — never in a response body, the DOM, a log line, or a clipboard.
A scanner can fetch the landing page all day and burn nothing.

Single-use is one atomic conditional `UPDATE`; TTL is 15 minutes in our code;
the three failure states have distinct messages. Audit-first ordering is
unchanged, and `consumed_at` now makes "was it actually used?" answerable from
the table instead of inferred from `last_sign_in_at`.

## Open follow-up — identify the scanner

Not needed to ship; useful to know what is scanning admin traffic. Run in the
Supabase SQL editor (the `auth` schema is not reachable over PostgREST):

```sql
-- Who actually redeemed the impersonation links during the incident?
-- audit_log_entries.payload holds the action + actor; ip_address is the caller.
select
  e.created_at,
  e.ip_address,
  e.payload ->> 'action'     as action,
  e.payload ->> 'actor_id'   as actor_id,
  left(e.payload ->> 'actor_username', 2) || '***' as actor_masked
from auth.audit_log_entries e
where e.created_at between timestamptz '2026-08-25 18:00:00Z'
                       and timestamptz '2026-08-26 13:30:00Z'
  and e.payload ->> 'actor_id' in (
        select distinct target_user_id::text
        from impersonation_log
        where created_at >= timestamptz '2026-08-25 00:00:00Z'
      )
order by e.created_at asc;
```

Then compare each `ip_address` against the IP the admin's own browser used:

```sql
-- The admin's own session activity in the same window, for contrast.
select e.created_at, e.ip_address, e.payload ->> 'action' as action
from auth.audit_log_entries e
where e.created_at between timestamptz '2026-08-25 18:00:00Z'
                       and timestamptz '2026-08-26 13:30:00Z'
  and e.payload ->> 'actor_username' ilike '%@haevn.co'
order by e.created_at asc;
```

**What to look for:** if the `login`/`token_refreshed` rows for the *member*
accounts carry an IP that is not the admin's own IP — a cloud range (AWS, Azure,
Google), a security vendor, or a datacentre ASN — that is the scanner. If it is
the *same* IP as the admin, the consumer is local to their machine: a browser
extension or endpoint security agent.

Either way the fix already holds, because neither one issues a form POST.
