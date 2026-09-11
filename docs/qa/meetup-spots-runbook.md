# Meetup Spots feed — QA runbook

For a browser-based QA agent. Verifies the nightly anonymized pair feed end to
end — build, HMAC signature, push, receipt, privacy contract — **without the
client's real endpoint existing and without production ever pushing anywhere.**

> **Production stays dark.** `MEETUP_FEED_ENABLED`, `EMERGENT_MEETUP_ENDPOINT`
> and `MEETUP_FEED_PUSH_SECRET` are **absent in Production** and must stay that
> way. Everything here happens in a preview deployment or a local prod build.

---

## 0. Read this first — the shared-database constraint

Vercel previews for this project **share production's Supabase**
(`SUPABASE_SERVICE_ROLE_KEY` is one value across Production, Preview and
Development). Fixtures you seed land in the production database.

Two things make that safe, and you should understand both:

| Protection | What it stops |
|---|---|
| `badges = ['QA_FIXTURE']` + the feed's exclusion gate | Production's nightly cron **cannot see fixtures**, so its `pair_count` is unaffected even while fixtures exist. |
| `profile_state = 'draft'` | The weekly recompute only iterates `profile_state='live'`, so a fixture **can never be matched against a real member**. |

**Always run teardown in the same session as the seed.** Protection is structural,
but leaving fixtures around is still untidy and will confuse the next reader.

**Never touch:** any partnership without a `TEST-` prefix; the real
Canby–Georgetown matched pair; production environment variables.

---

## 1. Two lanes — pick one

### Lane A — local prod build (recommended for the push)
Fully self-contained. No Vercel Deployment Protection, so the server-to-server
push works with no extra credentials. **This is the lane that proves the push,
the HMAC and the failure modes.**

### Lane B — preview deployment (for browser UI work)
Use when the agent must click through real admin UI. Two caveats:

1. **Preview deployments are SSO-protected.** Every request needs Vercel auth —
   see §2.
2. The push is a server-to-server call from the preview to its own protected
   URL, so it will get a `302` to Vercel SSO unless a **Protection Bypass for
   Automation** secret exists. **One is deliberately not configured** — a bypass
   secret is project-wide and would weaken production too. See §7 open item.

---

## 2. Access (Lane B only)

Preview URL:

```
https://haevn-mvp-git-qa-meetup-harness-dev-1098s-projects.vercel.app
```

**For HTTP checks**, use `vercel curl`, which carries the caller's Vercel auth:

```bash
vc curl https://haevn-mvp-git-qa-meetup-harness-dev-1098s-projects.vercel.app/api/qa/mock-emergent?qa_secret=$QA_SECRET
```

**For browser automation**, attach the short-lived development OIDC token as an
origin-scoped request header before the first navigation:

```
x-vercel-trusted-oidc-idp-token: <VERCEL_OIDC_TOKEN>
```

```bash
vc env run -- sh -c \
  'test -n "$VERCEL_OIDC_TOKEN" && agent-browser open "$1" --headers "{\"x-vercel-trusted-oidc-idp-token\":\"$VERCEL_OIDC_TOKEN\"}"' \
  sh https://haevn-mvp-git-qa-meetup-harness-dev-1098s-projects.vercel.app
```

Never print, screenshot or commit that token. Do **not** disable Deployment
Protection to make a step pass.

**Secrets** (`QA_HARNESS_SECRET`, `MEETUP_FEED_PUSH_SECRET`, `MEETUP_PAIR_SALT`)
are set on the Preview environment only. Read them with
`vercel env pull <file> --environment=preview`; never paste them into a report.

**Admin sign-in:** the admin dry-run route is allowlist-gated by email
(`lib/admin/allowlist.ts` — `raunek@xpandai.com`, `raunek@cloudsteer.com`,
`rikfoote@haevn.co`). There is no QA admin account. If the agent needs the admin
route, sign in as an allowlisted address; otherwise use the cron route in §4,
which is Bearer-gated and needs no session.

---

## 3. Seed the fixtures

```bash
npx tsx scripts/qa/seed-meetup-fixtures.ts
```

Idempotent — safe to re-run. Creates six `TEST-` partnerships and five pairs:

| Fixture pair | Score | Released | Expected in feed |
|---|---|---|---|
| Austin-Alpha × Austin-Bravo | 88 | yes | **match** |
| Portland-Charlie × Portland-Delta | 78 | yes | **recommendation** |
| Austin-Alpha × Centreville-Echo | 79 | yes | **recommendation**, one member `geo_unresolved` |
| Austin-Bravo × Austin-Foxtrot | 70 | yes | ⚠️ **currently appears** — see §7 |
| Austin-Alpha × Portland-Delta | 85 | **no** (future `release_at`) | **absent** |

Expected `pair_count` with `QA_FIXTURES_ONLY=true`: **4**.

---

## 4. Trigger a build and a push

### 4a. Admin dry-run — build, return a sample, push nothing

`POST /api/admin/meetup-feed` with an allowlisted admin session:

```json
{ "dry_run": true, "limit": 5 }
```

**Output appears in the HTTP JSON response only** — there is no admin UI page for
it. The response carries `pair_count`, `stats` and a `sample` array of records.
`limit: 0` returns the whole payload.

### 4b. Real push — the nightly cron path

```bash
curl -s "$BASE/api/cron/meetup-feed" -H "Authorization: Bearer $CRON_SECRET"
```

or `POST /api/admin/meetup-feed` with `{"dry_run": false}`.

Local (Lane A) environment:

```bash
export QA_HARNESS_ENABLED=true QA_FIXTURES_ONLY=true
export QA_HARNESS_SECRET=<preview value>   MEETUP_FEED_PUSH_SECRET=<preview value>
export MEETUP_PAIR_SALT=<preview value>    MEETUP_FEED_ENABLED=true
export CRON_SECRET=local-qa-cron-secret
export EMERGENT_MEETUP_ENDPOINT="http://127.0.0.1:3100/api/qa/mock-emergent?qa_secret=$QA_HARNESS_SECRET"
npx next start -p 3100
```

> The QA secret rides in the **endpoint URL**. `pushMeetupFeed` sends only the
> HMAC headers and has no concept of a QA secret — that is deliberate, so the QA
> harness needs no change to production code.

---

## 5. Read what the mock receiver got

```bash
GET /api/qa/mock-emergent?qa_secret=<secret>&limit=3       # summaries
GET /api/qa/mock-emergent?qa_secret=<secret>&limit=1&full=1 # with the payload
DELETE /api/qa/mock-emergent?qa_secret=<secret>             # clear receipts
```

Receipts are `system_events` rows of type `qa_meetup_received` (no migration
needed). Each carries `signature_valid`, `signature_reason`, `forbidden_keys`,
`pair_count`, `body_bytes`, `forced_failure` and the payload itself.

**Failure modes** — append to the endpoint URL:

| Toggle | Effect |
|---|---|
| `?fail=1` | Receiver returns **500** *after* storing the receipt. Sender must log `push.ok=false, status=500`. |
| `?fail=auth` | Receiver returns **401** before storing. Tests the bad-credential path. |

---

## 6. Pass/fail criteria

| # | Step | PASS |
|---|---|---|
| 1 | Seed | 6 `TEST-` partnerships, 5 pairs, no error |
| 2 | Gate — no QA secret | `POST` → **401** |
| 3 | Gate — wrong QA secret | **401** |
| 4 | Gate — valid secret, no HMAC headers | **401** (`signature_reason` names the missing header) |
| 5 | Gate — `?fail=auth` | **401** |
| 6 | Build | `pair_count` = **4** with `QA_FIXTURES_ONLY=true` |
| 7 | Push | `push` = `{"pushed":true,"status":200,"ok":true}` |
| 8 | Receipt | `signature_valid: true`, `signature_reason: "verified"` |
| 9 | **Privacy** | `forbidden_keys: []` **and** the serialized payload contains no `TEST-`, no `qa.invalid`, no UUID, no `hotel` |
| 10 | Shape | payload keys exactly `snapshot_date, generated_at, pair_count, pairs`; record keys exactly `pair_id, type, active, members, qualified_meetup_categories`; member keys exactly `role, city_id, city_label, centroid, max_distance_miles, mobility, geo_unresolved` |
| 11 | Types | exactly **1** `match` and **3** `recommendation` |
| 12 | Geo | Austin / Round Rock / Portland / Beaverton resolve to centroids; the Centreville member has `geo_unresolved: true`, `centroid: null` **and is still present** (2 members in the record) |
| 13 | Unreleased | the future-`release_at` pair is **absent** |
| 14 | Failure mode | `?fail=1` → `push.status=500, ok=false`, and a receipt is still stored |
| 15 | **Production isolation** | `vercel env ls production` shows **0 of 3** feed vars |
| 16 | Teardown | `remaining fixtures: 0 ✓ clean` |

**Any of 2–5, 9 or 15 failing is a stop-the-line failure.** Report and do not
continue.

---

## 7. Known issues and open questions — read before filing a bug

### ⚠️ Sub-threshold pairs are not filtered
`lib/meetup/buildFeed.ts` declares `const REC_MIN = 77` **and never uses it.**
The feed emits every released, non-expired pair regardless of score.

In production this is currently harmless — `computeMatches` only *stores* rows
at ≥77 (`STORE_MIN_SCORE`), so the floor is enforced upstream. But any row
written below 77 by any other path flows straight to the client.

The 70-score fixture exists to probe this and **currently appears in the feed**.
That is the code's real behaviour, not a harness bug. **Do not file it as a
failure** — it is flagged for the client in §8.

### ⚠️ The preview push needs a Protection Bypass decision
See §1 Lane B. Use Lane A for push verification until that is resolved.

### Teardown
```bash
npx tsx scripts/qa/teardown-meetup-fixtures.ts            # removes everything
npx tsx scripts/qa/teardown-meetup-fixtures.ts --keep-received  # keeps receipts
```
Removes by tag two ways (`TEST-` prefix **and** the badge), so a partially
failed seed still cleans up. It prints `remaining fixtures: 0 ✓ clean` on success
and exits non-zero otherwise.

---

## 8. The payload contract — what we believe, and what is uncertain

Derived from `lib/meetup/types.ts` (the allowlists are enforced in code) and
`pushMeetupFeed`. **This is HAEVN's side of the contract. It has not been
confirmed against Rik's Emergent app.**

```jsonc
{
  "snapshot_date": "2026-09-11",        // UTC YYYY-MM-DD
  "generated_at":  "2026-09-11T01:02:03.000Z",
  "pair_count":    4,
  "pairs": [{
    "pair_id": "<64-char hex>",          // HMAC-SHA256(MEETUP_PAIR_SALT, "smaller:larger")
    "type": "match",                     // "match" (>=80) | "recommendation"
    "active": true,                      // always true in the emitted set
    "members": [{
      "role": "a",                       // positional only; "a" = smaller partnership id
      "city_id": "austin-tx",
      "city_label": "Austin",
      "centroid": [30.2672, -97.7431],   // [lat, lon], null when unresolved
      "max_distance_miles": 25,          // null when unknown
      "mobility": "frequent",            // local|occasional|frequent|flexible|unknown
      "geo_unresolved": false
    }, { "role": "b" /* … */ }],
    "qualified_meetup_categories": [
      { "category": "coffee", "confidence": "high" }   // high|normal|low_confidence
    ]
  }]
}
```

Transport: `POST`, `Content-Type: application/json`,
`X-HAEVN-Signature: sha256=<hex>` over `` `${timestamp}.${rawBody}` ``,
`X-HAEVN-Timestamp: <unix seconds>`.

**Categories emitted:** `coffee`, `restaurant`, `activity`, `cocktail_bar`,
`wine_bar`, `brewery`. **`hotel` is deliberately excluded in v1** pending the
client's stage rules — the QA suite asserts it never appears.

### Flagged for the client — we are guessing on these

1. **Does Emergent verify the signature the way we sign it?** We sign
   `` `${timestamp}.${rawBody}` `` and send `sha256=<hex>`. The mock receiver
   validates exactly that, so we prove we are *self-consistent* — not that Rik's
   app agrees. **Needs confirming with Rik.**
2. **Replay window.** The mock rejects a timestamp more than **600s** skewed.
   That number is ours, not the client's.
3. **Is `snapshot_date` expected to be unique per day?** We send one snapshot per
   nightly run; behaviour on a same-day re-push (upsert vs duplicate) is undefined
   on our side.
4. **Does the client expect removals?** We send only *active* pairs. There is no
   tombstone for a pair that has dropped out — the receiver must infer
   disappearance from absence. Never discussed.
5. **`max_distance_miles: 9999`** is our sentinel for "any distance". A literal
   9999 could be misread as a real radius.
6. **`city_id` stability.** Our ids (`austin-tx`) come from a static table. If
   Emergent keys off them, renaming one would break their join.
7. **Sub-threshold pairs** — see §7. Whether the client expects a score floor at
   all is unconfirmed, since score never crosses the boundary.

---

## 9. Where each thing lives

| Thing | Path |
|---|---|
| Feed builder + push | `lib/meetup/buildFeed.ts` |
| Payload contract + allowlists | `lib/meetup/types.ts` |
| QA gate / badge / flags | `lib/meetup/qaFixtures.ts` |
| Mock receiver | `app/api/qa/mock-emergent/route.ts` |
| Admin dry-run / manual push | `app/api/admin/meetup-feed/route.ts` |
| Nightly cron | `app/api/cron/meetup-feed/route.ts` (`0 8 * * *` UTC) |
| Seed / teardown | `scripts/qa/{seed,teardown}-meetup-fixtures.ts` |
| Contract tests | `lib/meetup/__tests__/qaHarness.test.ts` |
