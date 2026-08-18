# Meetup Spots — Nightly Anonymized Pair Feed (v1 Plan)

**Status:** RECON + PLAN — hard stop before build.
**What this is:** a nightly, anonymized snapshot of the current released match/rec pairs, pushed to the client's Emergent B2B environment so his side can compute *Qualified Meetup Opportunities* against prospective business addresses.
**Fixed division of labor:**
- **Production (us)** owns *pair truth* + per-pair `qualified_meetup_categories` + per-member coarse geo (city + centroid) + travel-willingness.
- **His side (Emergent)** owns geo-vs-business distance math, thresholds, and pricing.
- **Never crosses the boundary:** identities, exact addresses, precise coordinates, partnership/user IDs (only a salted pair ID). Full contract in §6.

---

## 1. Survey field inventory (honest, with fill rates)

Source of truth: `lib/survey/questions.ts` (definitions); values live in `user_survey_responses.answers_json` keyed by question `id`. **Completed surveys: 607** (of 759 rows, `completion_pct >= 100`). Fill % below is of those 607.

| Field (`id`) | Question | Shape | Fill | Role |
|---|---|---|---|---|
| `q16a_first_meet_preference` | "How do you like to meet for the first time?" | `select` | **99%** | category signal (modality) |
| `q18_substances` | "How do you relate to alcohol or other substances?" | `multiselect` (array) | **100%** | alcohol-venue gate |
| `q19a_max_distance` | "Farthest distance you'd consider" | `select` | **100%** | geo output (travel willingness) |
| `q19b_distance_priority` | "Is closer better?" | `select` | 77% | geo output (secondary) |
| `q19c_mobility` | "How mobile are you?" | `select` | 98% | geo output (secondary) |
| `q36_social_energy` | social energy 1–9 | `number` | 100% | activity-confidence (secondary) |

**Actual stored value distributions (this is what's really in the data — note the short-code encoding):**

- **`q16a_first_meet_preference`** (codes): `coffee` 29% · `drinks` 20% · `dinner` 12% · `act` 11% · `walk` 11% · `video` 10% · `oth` 6% · (+ <1% full-label strings like `"I'm flexible — Let's decide together"`).
- **`q19a_max_distance`** (codes): `25` 29% · `50` 24% · `city` 21% · `100` 10% · `int` 6% · `nat` 5% · `250` 3% · (+ <1% full labels).
- **`q19c_mobility`**: `local` 49% · `sometimes` 29% · `flex` 14% · `freq` 5%.
- **`q18_substances`** (array, % of members selecting): `drink` 63% · `cann` 27% · `no_cann` 24% · `no_drink` 22% · `psy` 13% · `sober` 12% · `oth` 10%.
- **`q36_social_energy`**: clusters 2–4 (mean ≈3); ≥5 only ~9%.

> ⚠️ **Encoding caveat (must handle in the mapping layer):** the *definitions* store full labels (`"Within 25 miles"`, `"Walk or coffee — Keep it light and easy"`, `"Social drinker"`), but ~99% of live rows hold short codes (`25`, `coffee`, `drink`). The survey's storage changed over time. The normalizer must accept **both** forms per field, and log any unrecognized token (fail-safe: treat as "unknown", never crash).

**Absent (confirmed):** no venue/address question, no public-vs-private-space question, no numeric-radius field (distance is a coarse enum), and **no field granular enough to distinguish cocktail bar vs wine bar vs brewery** — those three are one group in v1.

---

## 2. Geo reality + city→centroid proposal

Measured over the **170 partnerships in the current released pair set** (and 764 total — same story):

| Geo field | Fill | Verdict |
|---|---|---|
| `city` | **100%** | the only reliable member geo |
| `zip_code` | **34%** (66% null) | *not* ~97% null as assumed, but still unreliable — 2/3 missing |
| `latitude`/`longitude` | **0%** | no coordinates exist at all |

**Conclusion:** city is the sole dependable geo; coordinates must come from a **city→centroid** mapping, not member data.

**Proposal — static `CITY_CENTROIDS` table (no external geocoding dependency in v1):**
- Keyed by a normalized city name → `{ city_id, lat, lon }`. `city_id` = a stable slug (e.g. `austin-tx`).
- Covers the **57 distinct city values** currently in the feed universe. Distribution is concentrated: Austin 79, Portland 14, Round Rock 8, Leander 5, San Marcos 3, then a long tail of 1–2 (mostly Austin-metro TX + Portland-metro OR, a few FL/other).
- **Normalization required** before lookup: lowercase + trim; collapse known aliases (`"Tampa/St. Pete"` → `tampa`, `"Mcminnville"` → `mcminnville`). The 57 raw values are enumerated in an appendix at build time.
- **Unknown city → fail-safe:** emit the pair with `city_id: null`, `centroid: null`, and a `geo_unresolved: true` flag on that member; his side skips it. Never drop the whole pair silently; log the unresolved city so the static table can be extended.
- Centroids are city-level (public, non-personal, identical for everyone in the city) — consistent with the "no precise coordinates" privacy rule.

---

## 3. Category rubric v1

Seven-category **extensible enum**: `coffee`, `restaurant`, `cocktail_bar`, `wine_bar`, `brewery`, `activity`, `hotel`. Production computes `qualified_meetup_categories` per pair; conservative where signal is missing.

| Category | Qualifying signal (v1) | Fallback when signal missing |
|---|---|---|
| `coffee` | **Always** (universal, low-commitment baseline) | — |
| `restaurant` | **Always** (baseline) | — |
| `activity` | **Always** (baseline; `q36_social_energy` high on both → `high_confidence`, else normal) | — |
| `cocktail_bar` | **Both** members alcohol-positive: `q18` contains `drink`/`Social drinker` (or `Regular user`) **and neither** side is `sober`/`no_drink` | if either side's `q18` absent → include with `low_confidence`; if either side **sober** → **exclude** (respect sobriety) |
| `wine_bar` | same as `cocktail_bar` (grouped — no field distinguishes them in v1) | same |
| `brewery` | same as `cocktail_bar` | same |
| `hotel` | **Excluded in v1** — pending the client's stage rules; connection-stage data is ~all zeros today | — |

**Notes:**
- `q16a_first_meet_preference` is **NOT used in the v1 rubric** — the always-qualify trio + the alcohol gate are sufficient. It is reserved as the **v2 confidence-weighting input** (e.g. mutual `coffee` preference boosting the `coffee` category once the client reacts to v1 output). It is neither gated on nor emitted in v1.
- Alcohol venues **share one gate** (both sides alcohol-positive, neither sober; else `low_confidence`; sober either side → exclude) but are **emitted as three distinct categories** — `cocktail_bar`, `wine_bar`, `brewery`. The grouping is *our* gating logic; his sales tool sees three independent categories and never needs to know they share a gate.
- Hotels **emit nothing** — absence from the output enum is the honest state until the client's stage rules arrive.
- Every category carries `confidence: "high" | "normal" | "low_confidence"` so his side can weight/price accordingly (baseline coffee/restaurant = high; activity = high when both `q36` ≥ 4, else normal; alcohol = normal when both positive, low_confidence when a side is unknown).

---

## 4. Record schema (per pair)

```jsonc
{
  "snapshot_date": "2026-08-19",            // UTC date the cron ran
  "pair_id": "9f3c…",                        // HMAC-SHA256(MEETUP_PAIR_SALT, "<p_smaller>:<p_larger>"), hex — stable nightly, unlinkable without salt
  "active": true,                            // in the current released set this run
  "members": [
    {
      "role": "a",                           // positional only (a = canonical smaller); NOT a partnership id
      "city_id": "austin-tx",
      "city_label": "Austin",
      "centroid": [30.2672, -97.7431],       // city-level, public
      "max_distance_miles": 25,              // normalized from q19a (see map below)
      "mobility": "local",                   // normalized q19c: local | occasional | frequent | flexible
      "geo_unresolved": false                // true when city not in the centroid table
    },
    { "role": "b", "...": "..." }
  ],
  "qualified_meetup_categories": [           // production-owned, from the §3 rubric
    { "category": "coffee",      "confidence": "high" },
    { "category": "restaurant",  "confidence": "high" },
    { "category": "activity",    "confidence": "normal" },
    { "category": "cocktail_bar","confidence": "normal" },
    { "category": "wine_bar",    "confidence": "normal" },
    { "category": "brewery",     "confidence": "normal" }
  ]
}
```

**`q19a` → `max_distance_miles` normalization:** `city`/neighborhood → 5 · `25` → 25 · `50` → 50 · `100` → 100 · `250` → 250 · `nat`/`int` → 9999 (effectively unbounded). Unrecognized → omit field + log.

The nightly payload is `{ snapshot_date, generated_at, pair_count, pairs: [ …records ] }`.

**Feed universe:** all released `computed_matches` rows (matches ≥80 **and** rec band 77–79 — "match/rec pairs"), canonicalized + deduped. Current size: **377 released directional rows → ~188 unique active pairs** across 170 partnerships (exact count computed at run).

---

## 5. Feed mechanics

**Stable pair ID.** `canonicalPartnershipPair(a,b)` → `{partnership_smaller, partnership_larger}` (UUID string-sorted, deterministic). `pair_id = HMAC-SHA256(process.env.MEETUP_PAIR_SALT, ` `${partnership_smaller}:${partnership_larger}` `).hex`. Dedicated salt (not reused from signing) → same ID every night, unlinkable back to partnerships without the salt. Partnership/user IDs never leave the server.

**Nightly cron** (mirrors `vercel.json` convention — existing: `0 12/14/16 * * 1`, `0 6 * * *`, `0 23 * * 6`):
- New entry: `{ "path": "/api/cron/meetup-feed", "schedule": "0 8 * * *" }` (08:00 UTC nightly; clears the Monday 12/14/16 and daily-06 windows).
- Route `app/api/cron/meetup-feed/route.ts`: `GET`, auth `Authorization: Bearer ${CRON_SECRET}` (identical to `recompute-matches`/`renotify`), `createAdminClient()`, `export const maxDuration = 300`, `console.log('[Cron meetup-feed] …')`, writes a `system_events` summary row (`event_type: 'meetup_feed_push'`, `triggered_by: 'cron'`, metadata = counts only, **no PII**).

**Outbound push** (mirror of the inbound `app/api/ingest/survey` HMAC, in reverse):
- Sign `${timestamp}.${rawBody}` with `createHmac('sha256', MEETUP_FEED_PUSH_SECRET).update(...).digest('hex')`.
- Headers: `X-HAEVN-Signature: sha256=<hex>`, `X-HAEVN-Timestamp: <unix secs>`, `Content-Type: application/json`. POST to `EMERGENT_MEETUP_ENDPOINT`.
- **Fail-safe (mirrors `RENOTIFY_ENABLED`):** the push runs only if `MEETUP_FEED_ENABLED === 'true'` **and** both `EMERGENT_MEETUP_ENDPOINT` and `MEETUP_FEED_PUSH_SECRET` are set. If any is missing → build the snapshot, log `[Cron meetup-feed] disabled/unconfigured — skipping push (N pairs)`, return `{ ok: true, skipped: true, pair_count: N }`. **Never errors, never blocks.** (Endpoint URL + shared secret are pending from the client — see §7.)

**New env vars:** `MEETUP_PAIR_SALT`, `MEETUP_FEED_PUSH_SECRET`, `EMERGENT_MEETUP_ENDPOINT`, `MEETUP_FEED_ENABLED`.

---

## 6. Privacy contract (the list IS the contract)

**Crosses the boundary (allowed):**
- `pair_id` (salted HMAC), `active`, `snapshot_date`, `generated_at`, `pair_count`.
- Per member: `role` (positional a/b), `city_id` + `city_label`, `centroid` (city-level), `max_distance_miles` (coarse enum→miles), `mobility` (coarse enum), `geo_unresolved`.
- Per pair: `qualified_meetup_categories` (+ confidence).

**Never crosses (asserted):** names, emails, phone, photos, bios, **user IDs, partnership IDs** (only the salted pair ID), exact addresses/ZIP, **precise/personal coordinates**, DOB/age, gender, orientation, relationship structure, membership tier, match score, and **any raw survey answer** (only the *derived* geo/travel/category fields above leave — `q16a`/`q18` are inputs, computed into categories server-side, and are not emitted). A build-time test will assert the serialized payload contains none of these.

---

## 7. Open questions for the client

1. **Emergent endpoint URL + shared push secret** — pending; until provided the cron runs fail-safe (builds + logs, no push).
2. **Hotels:** you said intentional but stage-appropriate. What's the qualifying rule? Connection-stage data is ~all zeros today, so v1 excludes hotels — confirm, and define the stage gate for v2.
3. **Alcohol sub-types:** cocktail bar / wine bar / brewery are one group in v1 (no field distinguishes them). OK to group, or do you need a new survey question?
4. **Match score / tier:** we propose *not* sending either (not needed for meetup qualification). Confirm.
5. **Feed contents:** confirm "match/rec pairs" = all released pairs incl. the 77–79 rec band (assumed yes).
6. **City list:** confirm the ~57-city static centroid table + the unknown-city fail-safe (emit with `geo_unresolved`, don't drop). New markets extend the table.
7. **Cadence/time:** 08:00 UTC nightly OK?
8. **Salted pair ID:** confirm HMAC-with-dedicated-salt is acceptable as the only cross-boundary identifier (stable per pair, unlinkable without the salt).

---

**HARD STOP.** No code until approval. On sign-off, build is one PR: `CITY_CENTROIDS` + normalizers (pure, tested) → rubric (pure, tested) → snapshot assembler + redaction test (payload contains none of the §6 forbidden fields) → cron route + fail-safe push. Endpoint/secret can land later without blocking the build (fail-safe skip).
