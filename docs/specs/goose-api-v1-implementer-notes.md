# Goose ↔ HAEVN API v1 — implementer notes

Companion to the locked contract v1.0 and its addendum. This page does not change the
contract. It adds the details an implementer needs: exact bodies, error codes, limits and
timing.

**Base URL:** `https://www.haevn.app/api/goose`. Always use **www**. The apex domain
redirects, and a redirected POST loses its body and headers.

## Auth

`Authorization: Bearer <GOOSE_SHARED_SECRET>` on every request.

| Condition | Response |
|---|---|
| Header missing, malformed, wrong scheme, or wrong token | `401`, **empty body** |
| HAEVN side not configured (secret unset) | `503`, **empty body**. Every route fails closed. |

The token is never logged or echoed.

## Endpoints

All bodies are JSON. Responses carry `cache-control: no-store`.

### 1. `POST /cohorts`

```json
{ "goose_event_id": "evt_047", "event_name": "Friday Social", "event_starts_at": "2026-11-14T20:00:00-06:00" }
```

- Response: `200 {"haevn_cohort_id": "<uuid>"}`.
- Idempotent on `goose_event_id`. A repeat returns the same id and never creates a duplicate.
- A repeat **does not update** `event_name` or `event_starts_at`.
- Validation:
  - `goose_event_id`: non-empty string, at most 200 characters.
  - `event_name`: optional string, at most 300 characters.
  - `event_starts_at`: ISO 8601 **with** a timezone (`Z` or `±hh:mm`). Without one, the request is rejected.

### 2. `POST /cohorts/{haevn_cohort_id}/members`

Send **exactly one** of these identifiers:

```json
{ "member_email": "guest@example.com" }
```

```json
{ "member_id": "<partnerships.id>" }
```

- Response: `200 {"member_id": "<uuid>", "associated": true, "survey_complete": true|false}`.
- Idempotent: repeating an association returns the identical body.
- Email matching is case-insensitive. It resolves either partner of a couple to the couple's
  shared `member_id`.
- `survey_complete` is informational only. Association never makes a guest eligible.
- Errors:
  - `404 {"error":"member_not_found"}`
  - `404 {"error":"cohort_not_found"}`
  - `400 invalid_request` when both identifiers, neither, or a malformed email is sent.

### 3. `POST /cohorts/{haevn_cohort_id}/finalize`

```json
{ "member_ids": ["<uuid>", "..."] }
```

- Response: `200 {"status":"processing","expected_pairs": N*(N-1)/2}`, where N counts
  **distinct** ids. A couple listed twice counts once.
- **Every id must already be associated** with this cohort. Otherwise the call returns
  `400 {"error":"unknown_members","unknown_member_ids":[...]}`. Nothing is finalized, and any
  prior population stays as it was. This check is all-or-nothing.
- Re-finalizing replaces the population and recomputes. Results from the previous population
  are discarded.
- **Async.** The response returns at once and the compute runs on HAEVN right after it.
  Status is the source of truth. At V1 scale Ready lands in about 1–2 s; see Timing below.
- At most **500** distinct members per finalize. Larger lists get `400 invalid_request`.

### 4. `GET /cohorts/{haevn_cohort_id}/status`

```json
{ "status": "processing|ready|error", "expected_pairs": 15, "completed_pairs": 15,
  "finalized_at": "<iso>|null", "ready_at": "<iso>|null" }
```

- `ready` means the unique pairs over the finalized population **exactly** equal
  `expected_pairs`, verified when you read it.
- `error` means compute failed or came back incomplete. HAEVN is already retrying and has
  already alerted ops. Keep polling: a successful retry turns the status to `ready` with no
  action from you.
- A cohort that was never finalized reads `processing` with `0/0`.

### 5. `GET /cohorts/{haevn_cohort_id}/results`

```json
{ "status": "ready", "pairs": [ { "member_id_a": "...", "member_id_b": "...",
  "compatibility_pct": 84, "classification": "Strong Alignment", "headline": "A STRONG MATCH",
  "considerations": "…", "photo_url_a": "https://…|null", "photo_url_b": "https://…|null" } ] }
```

- One row per unordered pair, with `member_id_a < member_id_b` as a string comparison.
  **Look up both orders**: the pair for guests X and Y is the row where
  `{a, b} = {X, Y}`.
- Before `ready`, the response is the partial set with the current `status` echoed. Do not
  treat it as complete.
- Every pair has a result, including low scores. Hard-gated pairs come back as
  `compatibility_pct: 0` with the 0–59 copy.
- Photo URLs are public HTTPS URLs to the member's primary photo, or `null`.

## Error bodies (complete list)

| Status | Body | When |
|---|---|---|
| 400 | `{"error":"invalid_request","detail":"<terse reason>"}` | Malformed JSON, missing or invalid field, body over 64 KB, more than 500 members |
| 400 | `{"error":"unknown_members","unknown_member_ids":[...]}` | Finalize lists ids that were never associated |
| 401 | *(empty)* | Auth failed |
| 404 | `{"error":"cohort_not_found"}` | Unknown or malformed cohort id, on any route |
| 404 | `{"error":"member_not_found"}` | Association could not resolve the member |
| 429 | `{"error":"rate_limited"}` + `Retry-After: <seconds>` | Per-route ceiling exceeded |
| 500 | `{"error":"internal_error"}` | Unexpected. Safe to retry; ops is alerted through logs. |
| 503 | *(empty)* | HAEVN side not configured |

## Rate limits

These are per route, per 60 seconds, and well above contract usage.

| Route | Ceiling |
|---|---|
| create | 60 |
| members | 600 |
| finalize | 30 |
| status | 600 (polling every 5 s per event is fine) |
| results | 300 |

On a `429`, honour `Retry-After`.

## Timing

Compute is roughly 45 µs per pair plus database I/O.

| Event size | Pairs | Ready after finalize |
|---|---|---|
| 6 guests | 15 | about 1–2 s |
| 47 guests | 1,081 | a few seconds |
| 500 guests (the cap) | ~125k | under a minute |

Results are precomputed. Lookups never trigger a calculation.
