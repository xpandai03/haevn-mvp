# Data hygiene — 2026-09-21

Closing the items the 2026-09-20 state-of-systems snapshot raised. Aggregates and
row ids only; no member data reproduced here.

## 1. Phone validation at write time

Nothing validated `partnerships.phone` on write. The only normalization was
client-side, US-only, inline in signup step 4, so anything arriving by another
path landed verbatim.

`lib/utils/phone.ts` normalizes to E.164 and returns `null` for anything
unusable. **A rejection never blocks a submission** — a member who mistypes
their phone still gets an account, a profile and email.

Gated, app-side:

| Entry point | Behaviour |
|---|---|
| `app/api/onboarding/save-identity` | normalizes; an unusable value is dropped and onboarding continues |
| `lib/actions/partnership-simple.updatePartnershipPhone` | normalizes; an unusable value returns a friendly error and writes nothing. A corrected number also clears `notify_phone_invalid_at`, so fixing your phone re-enables SMS |

**NOT gated, deliberately:** `app/api/ingest/survey` is the external funnel
shared with the marketing site (`HAEVN_INGEST_SECRET`). Tightening validation
there risks rejecting real submissions from a surface we do not control.
**Follow-up:** normalize on ingest *after* confirming the marketing form's
output format, or normalize post-insert on that path only.

## 2. ⚠️ Correction to the 2026-09-20 snapshot: there was no junk

That snapshot reported *"2 malformed phone numbers … both pure-alphabetic
placeholder strings with no digits at all"*. **That was wrong, and the error was
in the reporting tool, not the data.** Its shape function ran

```js
raw.replace(/\d/g,'D').replace(/[A-Za-z]/g,'A')
```

`D` is a letter, so the second pass converted every digit-marker to `A` and
**digits were reported as letters**. `"AAAAAAAAAAA"` meant *eleven digits*, not
eleven letters.

The two rows were ordinary 10- and 11-digit US numbers missing their country
code. **Acting on the original finding would have nulled two working phone
numbers.** They were normalized to E.164 instead:

```
0294fdd8…  11 digits -> valid E.164   (recovered)
b4ffa311…  10 digits -> valid E.164   (recovered)
ASSERT non-E.164 remaining: 0 | phones total: 412 before and after — none lost
```

The new validator would reject **0** of the 412 stored numbers. The 29
carrier-rejected numbers are a different problem, handled by migration 058
(mark the channel, stop re-attempting) and unaffected by this.

## 3. `network_snapshots` — the network-wide row

**Root cause: one impossible birthdate.** A member's survey holds
`q1_age = "1989-04-31"`. April has 30 days, so `get_composition_breakdown`
throws casting it. That member is in **Gladstone**, so the Austin-scoped call
never touched them and kept succeeding — while the **network** scope threw every
Saturday from 2026-08-29. Four weeks of network-wide history lost to one date,
invisible because the per-scope `catch` recorded it in an outcome nobody read.

`runSnapshot` now computes composition **separately** from the rest: a
composition failure degrades that one field and records `compositionError` in
the row, instead of discarding the whole scope. Member counts, weekly deltas and
engagement are the time series; losing them to a breakdown failure is the wrong
trade.

Verified: the network row writes again (`written: 2`, network marked
`degraded: "composition"` with the reason attached).

**Backfill: forward-only, and honest about why.** `getMetrics` computes from
*current* database state. `computed_matches` is destructively rewritten every
Monday, so the pair counts, match rates and weekly deltas for 2026-08-29 through
09-19 no longer exist anywhere. Reconstructing them would mean presenting
today's numbers under past dates — a fabricated time series is worse than a gap.
**The four weeks stay missing and are labelled as such.**

Second bad date found: `q1_age = "2026-06-10"` (a member born this year).
Harmless to the RPC but wrong; both belong in a survey-validation follow-up.

## 4. `gate_enforced` on recompute events

`excluded_non_live_market` means two opposite things depending on the flag: with
the gate on those members **were** withheld; with `RELEASE_ALL_MARKETS` on it is
**reporting only** and nobody was withheld. `notify_run` has always emitted
`gate_enforced`; `match_recompute` did not, so its rows read as *"411 members
blocked"* when zero were. Both now carry it.

## 5. Comp provenance

Four `plus` partnerships had `plus_source IS NULL`, predating the attribution
the Founding Member promo introduced. No `purchases` row backs any of them
(that table is empty), and all predate the 2026-09-07 promo launch.

```
ASSERT comp = 4                     ✅
ASSERT founding untouched = 25      ✅ (unchanged)
ASSERT remaining NULL = 0           ✅
```

One of the four, `22222222-2222-2222-2222-222222222222`, is clearly a **seeded
test row** rather than a real comp. It is tagged with the others so no untagged
`plus` remains, but it should be removed in a test-data cleanup — flagged, not
actioned here, because deleting member-shaped rows needs its own care.
