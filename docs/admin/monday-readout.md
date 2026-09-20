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
