# Monday readout — query set

Run after the three Monday crons: **12:00 UTC** recompute/release → **14:00 UTC**
notify (match, then the no-match ping) → **16:00 UTC** renotify.

Read-only. Substitute the run date for `'2026-09-07'` throughout.

---

## 1. Release — 12:00 UTC

```sql
SELECT created_at,
       metadata->>'rows_released_today'      AS rows_released,
       metadata->>'partnerships_total'       AS partnerships,
       metadata->>'completed'                AS completed,
       metadata->>'errors'                   AS errors,
       metadata->>'gate_failed_closed'       AS gate_failed_closed,
       metadata->>'excluded_non_live_market' AS non_live_city_spread,
       metadata->>'history_captured'         AS history_captured
FROM system_events
WHERE event_type = 'match_recompute' AND created_at::date = '2026-09-07'
ORDER BY created_at DESC;
```

**`rows_released_today` is "rows this run released", not "backlog newly made
visible".** The recompute rewrites every pair with `release_at` = next Monday and
the release step pulls all of them forward, so this number is roughly the whole
active pair set, most of which was already notified in earlier weeks. Sept 7:
762 released, of which 481 already carried a notification mark.

Once `RELEASE_ALL_MARKETS=true`, `excluded_non_live_market` withholds nobody — it
is the non-live city spread, kept for reporting only.

```sql
-- current release state
SELECT count(*) FILTER (WHERE release_at <= now()) AS released,
       count(*) FILTER (WHERE release_at >  now()) AS pending,
       count(*)                                    AS total
FROM computed_matches;
```

## 2. Match notifications — 14:00 UTC

```sql
SELECT created_at,
       metadata->>'eligible' AS eligible, metadata->>'sent'   AS sent,
       metadata->>'skipped'  AS skipped,  metadata->>'errors' AS errors,
       metadata->>'reason'   AS reason,
       metadata->>'gate_enforced' AS gate_enforced,
       metadata->'no_match_ping'  AS ping
FROM system_events
WHERE event_type = 'notify_run' AND created_at::date = '2026-09-07';
```

```sql
-- per-channel delivery + failure reasons
SELECT metadata->>'notification_type' AS type,
       count(*)                                             AS attempts,
       count(*) FILTER (WHERE (metadata->>'email_sent')::bool) AS email_sent,
       count(*) FILTER (WHERE (metadata->>'sms_sent')::bool)   AS sms_sent,
       count(*) FILTER (WHERE metadata->>'sms_error'   IS NOT NULL) AS sms_failed,
       count(*) FILTER (WHERE metadata->>'email_error' IS NOT NULL) AS email_failed
FROM system_events
WHERE event_type = 'notification_sent' AND created_at::date = '2026-09-07'
GROUP BY 1;
```

## 3. Handoff sign-in links — minting, consumption, and CHANNEL

Cron-minted rows have `request_ip IS NULL`; self-serve rows carry an IP.

```sql
SELECT count(*)                                        AS minted,
       count(*) FILTER (WHERE consumed_at IS NOT NULL) AS consumed,
       round(100.0 * count(*) FILTER (WHERE consumed_at IS NOT NULL)
             / nullif(count(*), 0), 1)                 AS conversion_pct
FROM login_links
WHERE created_at::date = '2026-09-07' AND request_ip IS NULL AND sent;
```

### ► Email vs SMS split (migration 057)

```sql
SELECT coalesce(channel, 'unattributed')               AS channel,
       count(*)                                        AS consumed,
       round(100.0 * count(*) / sum(count(*)) OVER (), 1) AS pct
FROM login_links
WHERE consumed_at::date = '2026-09-07'
  AND request_ip IS NULL          -- cron-minted only; self-serve is always NULL
GROUP BY 1
ORDER BY consumed DESC;
```

`channel` is **first tap only** — the token is single-use, so a member who taps
the SMS and then the email is counted once, as SMS.

`NULL` here means genuinely unattributable, and is expected for: rows created
before 057; any tap whose `?c=` marker was absent or unrecognised; and every
self-serve link (excluded above by the `request_ip` filter).

**Rows minted before 057 was applied are all NULL.** Attribution starts with the
first send after the migration — Sept 14. Sept 7's cohort stays unattributed
beyond the partial bound below.

```sql
-- partial attribution WITHOUT 057, from delivery mix: a member who had no phone
-- could only have arrived by email. Kept for comparing against pre-057 weeks.
SELECT count(*) FILTER (WHERE (metadata->>'email_sent')::bool
                          AND NOT (metadata->>'sms_sent')::bool) AS email_only_cohort,
       count(*) FILTER (WHERE (metadata->>'email_sent')::bool
                          AND (metadata->>'sms_sent')::bool)     AS both_channels
FROM system_events
WHERE event_type = 'notification_sent'
  AND metadata->>'notification_type' = 'match'
  AND created_at::date = '2026-09-07';
```

## 4. No-match ping

```sql
SELECT metadata->'no_match_ping' AS ping
FROM system_events
WHERE event_type = 'notify_run' AND created_at::date = '2026-09-07';

SELECT count(*) AS pinged_ever,
       count(*) FILTER (WHERE no_match_notified_at::date = '2026-09-07') AS pinged_today
FROM partnerships;
```

`no_match_notified_at` is set on **successful send only**, so a member whose
every channel failed keeps NULL and is retried on the next eligible run.

## 5. Renotify — 16:00 UTC

```sql
SELECT count(*) AS log_rows,
       count(*) FILTER (WHERE NOT dry_run
                          AND (sms_status = 'sent' OR email_status = 'sent')) AS real_sends,
       count(*) FILTER (WHERE suppressed_reason IS NOT NULL) AS suppressed
FROM renotify_log
WHERE run_date = '2026-09-07';
```

## 6. Founding Member funnel, by city

```sql
SELECT e.event_type, coalesce(p.city, '(unknown)') AS city, count(*)
FROM system_events e
LEFT JOIN partnerships p ON p.id = e.partnership_id
WHERE e.event_type IN ('upgrade_cta_clicked','founding_offer_viewed','founding_activation_completed')
  AND e.created_at >= '2026-09-04'
GROUP BY 1, 2 ORDER BY 1, 3 DESC;
```

```sql
SELECT city, promo_market, count(*)
FROM partnerships WHERE plus_source IS NOT NULL
GROUP BY 1, 2 ORDER BY 3 DESC;
```

`promo_market` holds a market **slug** when the member's city resolves to a
market (`austin`), otherwise their **city verbatim** (`Portland`), otherwise NULL.

### ⚠️ 2026-09-11 carries residual contamination

A preview-hosted QA harness wrote synthetic promo events into production on
**2026-09-11** (see
[preview-prod-isolation-2026-09-20.md](./preview-prod-isolation-2026-09-20.md)).
**78 positively-identified synthetic rows were deleted on 2026-09-20**, so the
day is materially clean — but three surviving `upgrade_cta_clicked` rows from
that day cannot be *proven* real, and no further row can be positively
classified either way.

Keep the existing convention: **exclude Sep 11** when the number goes to the
client. Add to the funnel query above:

```sql
  AND e.created_at::date <> '2026-09-11'
```

The difference is three CTA clicks (39 including Sep 11, 36 excluding it).
Offer views (35) and activations (18) are identical either way — **activations
were never contaminated**, so no activation figure previously reported to the
client was wrong.

## 7. Anomaly scan

```sql
SELECT event_type, count(*), min(created_at), max(created_at)
FROM system_events
WHERE created_at::date = '2026-09-07'
  AND event_type IN ('match_recompute','match_recompute_failed','notify_run',
                     'match_release','sms_notify')
GROUP BY 1 ORDER BY 1;
```

Expect **exactly one** of each per Monday. More than one means a retry or a
duplicate invocation. Any `match_recompute_failed` row is a hard failure.

Watch recompute duration (`finished_at - started_at`) against the 300s ceiling —
91s on Sept 7, and the pair set is growing (189 → 391 since July).

---

## 8. Send health — throttle, quota, invalid destinations

Added after 2026-09-21, when the first no-match ping lost 138 of 496 sends. The
failures were **not** a HAEVN bug: 146 hit Resend's 10/sec rate limit (we peaked
at 12/sec, unpaced) and 205 hit the daily quota. Those are different problems
with different fixes, and the readout now separates them.

```sql
SELECT
  (metadata->'no_match_ping'->>'sent')::int            AS ping_sent,
  (metadata->'no_match_ping'->>'failed')::int          AS ping_failed,
  (metadata->'no_match_ping'->>'throttleRetried')::int AS throttle_retried,
  (metadata->'no_match_ping'->>'quotaDead')::int       AS quota_dead,
  metadata->'no_match_ping'->'invalidSkipped'          AS invalid_skipped,
  metadata->'no_match_ping'->'invalidMarked'           AS invalid_marked,
  (metadata->'no_match_ping'->>'sendRatePerSec')::numeric AS rate_per_sec,
  metadata->>'sent' AS match_sent, metadata->>'errors' AS match_errors
FROM system_events
WHERE event_type = 'notify_run' AND created_at::date = CURRENT_DATE;
```

Read the columns like this:

| Column | Means | What to do |
|---|---|---|
| `throttle_retried` | sends that hit a rate limit and **succeeded on retry** | nothing — pacing working under load. A large number says lower `SEND_RATE_PER_SEC`. |
| `quota_dead` | the email plan's **daily cap was exhausted**; these can't succeed today | **upgrade the Resend plan.** No code change helps. These retry next Monday. |
| `invalid_skipped` | destinations a provider already called permanently invalid | nothing — they were skipped, not failed. |
| `invalid_marked` | destinations marked invalid by **this** run | expect a handful once, then ~0. A rising number means bad data at signup. |

**`quota_dead` is the one that needs a human.** Everything else is the system
absorbing a provider's limits; that column means we asked for more email than
the plan allows. Measured empirical cap on 2026-09-21: **202 emails/day**.

Per-channel failure detail for one day:

```sql
SELECT metadata->>'notification_type' AS type,
       count(*) FILTER (WHERE (metadata->>'email_sent')::bool) AS email_ok,
       count(*) FILTER (WHERE (metadata->>'sms_sent')::bool)   AS sms_ok,
       count(*) FILTER (WHERE metadata->>'email_error' LIKE '%daily_quota%')   AS quota,
       count(*) FILTER (WHERE metadata->>'email_error' LIKE '%rate_limit%')    AS throttled,
       count(*) FILTER (WHERE metadata->>'sms_error'   LIKE '%Invalid%')       AS bad_number
FROM system_events
WHERE event_type = 'notification_sent' AND created_at::date = CURRENT_DATE
GROUP BY 1;
```

Marked-invalid destinations (should stay small and stable):

```sql
SELECT count(*) FILTER (WHERE notify_phone_invalid_at IS NOT NULL) AS bad_phone,
       count(*) FILTER (WHERE notify_email_invalid_at IS NOT NULL) AS bad_email
FROM partnerships;
```

Clearing either column re-enables that channel — do it when a member updates
their details. **Never delete the underlying phone or email**; support needs to
see what the member actually typed.

## 9. Warm-interpretation cron

Runs Monday 13:00 UTC, between recompute and notify, behind
`INTERPRETATION_WARM_ENABLED` (default OFF).

```sql
SELECT metadata->>'coverage'     AS coverage,
       metadata->>'eligible'     AS eligible,
       metadata->>'processed'    AS processed,
       metadata->>'remaining'    AS remaining,
       metadata->>'generated'    AS generated,
       metadata->>'cached'       AS already_warm,
       metadata->>'degraded'     AS failed,
       metadata->>'cost_usd'     AS cost,
       (metadata->>'duration_ms')::int / 1000 AS seconds
FROM system_events
WHERE event_type = 'interpretation_warm'
ORDER BY created_at DESC LIMIT 10;
```

**`remaining > 0` is normal, not an error.** A generation averages ~12s and the
viewer set is ~683 directions — about 9,500s of work against a 300s ceiling. The
run takes a 240s budget, stops cleanly, and the next invocation continues.
Roughly 20 directions per run, so ~35 runs to warm the set fully.

There is no progress table: **the cache is the cursor.** A direction is done when
a fresh row exists for it, which `getMatchInterpretation` already decides. That
makes continuation safe across a crash, a redeploy, or a changed audience —
there is nothing to resume, only work remaining.

`seconds` should never exceed 240. If it does, a single generation ran long;
check `degraded`.

`WARM_COVERAGE` is the cost lever: `viewers` (default, ~683 directions, ~$0.93/wk)
or `all` (every released direction, ~$2.99/wk). Members outside the warm set
still get a report — generated on demand and cached for the next viewer.

### Quota headroom is verified by hand, before each Monday

**Resend exposes no quota or usage endpoint.** The SDK surfaces `emails`,
`batch`, `broadcasts`, `domains`, `logs`, `webhooks`, `audiences`, `contacts`,
`templates`, `segments`, `topics` and `apiKeys` — none of which reports how much
of the plan's daily or monthly allowance is left. There is nothing to poll, so
this cannot be automated today.

**Until it can be, check the Resend dashboard before each Monday run** and
confirm the remaining allowance covers the expected volume:

| | |
|---|---|
| Expected Monday email volume | **~620** (match phase + ping, incl. retries) |
| Monthly, notification email alone | **~2,500** |
| Plus | magic links, re-notify, connection nudges |

The only in-band signal is retrospective: a non-zero `quota_dead` in §8 means the
allowance ran out *during* the run, and those members go unsent until the
following week. By then the money is spent and the Monday is lost, which is why
the check is a pre-flight rather than a readout item.

**If Resend later ships a usage endpoint**, wire it into a pre-flight check in
the notify cron: abort with a loud event rather than half-sending. Track it as
the automation that closes this gap.

### Follow-up worth considering: batch sending

`resend.batch.send()` accepts up to **100 emails per API call**. At ~620 emails
that is **7 calls instead of 620**, which sidesteps the per-second rate limit
almost entirely and would cut the pacing cost from ~124s to seconds.

It does **not** help with the daily quota — 620 emails still count as 620
against the plan — so it is an efficiency and duration win, not a capacity one.
Not implemented here: the pacer already brings the run inside its budget, and
batching changes per-recipient error handling (one call, many results), which
needs its own care around which members get marked invalid or retried.
