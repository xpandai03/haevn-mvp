# Match Report Rebuild — recon + build plan

**Status:** plan only. No code, schema, or member-facing change has been made.
**Base:** `main` @ `a48a66b`.
**Recon date:** 2026-09-20. All production figures are read-only aggregates; no PII.
**Reference:** <https://haevn.co/match-example>, captured live with a real browser
(Playwright/Chromium, desktop 1440 + mobile 390, every disclosure expanded).
Archive: [`docs/specs/match-report-reference/`](../specs/match-report-reference/) —
`page.txt` (full verbatim text), `outline.json`, `headings.json`, desktop slices,
mobile header + category, full-page captures.

---

## 0. Executive summary

Five things decide this project, and four of them are not the UI.

1. **`match_interpretations` does not exist in production.** Migration `052` was
   never applied, while `053`–`057` were. The entire AI layer has never had a
   table to write to. Everything else here is downstream of fixing that.
2. **The document structure is much closer than it looks.** The existing schema
   already produces ~20 of the ~34 pair-specific fields the reference needs, and
   the category mapping is already exactly 1:1 with the reference's five names.
   The real gaps are three new document sections, not a rewrite.
3. **Cost is a non-issue.** ~$3.92/week for all 2,200 pair-directions on
   `gpt-4o-mini`. Nowhere near the $50/week flag.
4. **The header block is mostly unbuildable today.** Of the reference header's
   seven elements, four have little or no data behind them: photos 6.7%,
   verification 0%, bio 0%, distance 0%. This is the critical path, and it is a
   content/backfill problem, not an engineering one.
5. **Real match scores are 77–81, median 77.** The reference shows 84% with
   category scores spanning 73–96. The document's visual language assumes a
   spread production does not have.

---

## 1. Reference capture — verbatim structure

Page height: **7,867px desktop / 11,858px mobile**. Five disclosures (one per
category). Full text in [`page.txt`](../specs/match-report-reference/page.txt).

### 1.1 Header block

| Element | Reference value | Nature |
|---|---|---|
| Masthead | `HAEVN MATCH REPORT · REF · M-0084 · PREPARED FOR A HAEVN MEMBER` | static chrome + ref id |
| Back link | `← BACK TO HAEVN` | static |
| Photo | full-bleed portrait, rounded, ~1:1 | **data** |
| Distance badge | `📍 4 miles away` (overlaid top-left) | **data** |
| Name / age | `Darius, 35` (overlaid bottom-left) | **data** |
| Verified shield | small icon beside name | **data** |
| HAEVN+ badge | orange pill, `HAEVN+` | **data** |
| Eyebrow | `YOUR MATCH` | static |
| Title | `Your 84% Match with Darius.` | score + name |
| Sub-paragraph | *"Meaningful compatibility across all five categories, with a few real differences worth understanding. This is the kind of introduction HAEVN was built to make."* | **AI pair-specific** |
| Match ring | `84%` / `MATCH` | **data** |
| Threshold | `THRESHOLD` / `80% minimum` | static/config |
| Verified line | `VERIFIED` / `Identity confirmed via Veriff` | **data** |

### 1.2 Profile at a Glance

Six labelled fields in one row: **GENDER** `Man` · **AGE** `35` ·
**PRONOUNS** `He / Him` · **ORIENTATION** `Straight` · **LOCATION** `Austin, TX` ·
**STRUCTURE** `Monogamous`. Each with a small icon.

### 1.3 Document sections

| § | Heading | Content |
|---|---|---|
| 01 | `About {Name}` | 2 paragraphs of biography, third-person |
| 02 | `Why HAEVN Made This Introduction` | 3 paragraphs: what aligns → what differs → the verdict sentence |
| 03 | `Compatibility Breakdown` | standfirst *"Five categories. Each one earned."* + intro, then 5 category blocks |
| 04 | `Worth Talking About` | lead-in, 3 numbered items, closing line |
| 05 | `The Signals That Mattered` | lead-in + **6** chips |
| 06 | `Conversation Starters` | lead-in + 3 numbered items |
| — | `HAEVN'S READ` | verdict strip `84% MATCH · INTRODUCTION RECOMMENDED` + 1 paragraph |
| — | `END OF REPORT · SAMPLE MATCH VIEW` | static, sample-only |

### 1.4 Category block (×5) — the critical structure

Collapsed state: icon · `CATEGORY N` · name · `91%` · `FIT` · band pill (`STRONG`) ·
progress bar · a summary paragraph in the right column · `VIEW DETAILS ⌄`.

Expanded adds five labelled fields, **in this order**:

| Field | Static or pair-specific |
|---|---|
| `WHAT THIS MEASURES` | **STATIC per category** — belongs in code, never in the AI call |
| `WHY IT MATTERS` | **STATIC per category** — same |
| `YOUR ALIGNMENT` | pair-specific prose |
| `WHERE YOU DIFFER` | pair-specific prose |
| `HAEVN'S READ` | pair-specific, rule-left-border callout |

The five reference categories and scores: Goals & Expectations 91 STRONG ·
Structure Fit 96 STRONG · Emotional & Communication 84 STRONG ·
Sexual Compatibility 78 COMPATIBLE · Practical Fit 73 COMPATIBLE.

**Static/pair-specific split, counted:** 10 static category fields (2 × 5), plus
~14 static chrome strings. **34 pair-specific fields**: 1 header sub-paragraph,
3 (§02), 20 (5 categories × 4), 4 (§04), 6 (§05), 3 (§06), 2 (closing) —
minus overlap, see §4.

---

## 2. Current state

### 2.1 What the breakdown page renders today

[`app/dashboard/matches/[id]/breakdown/page.tsx`](../../app/dashboard/matches/%5Bid%5D/breakdown/page.tsx) (238 lines):

- title + `match_summary`/`executive_summary` paragraph
- `Your {score}% Match` heading
- "Your compatibility breakdown" → 5 × `SectionDetail` (name, score, band, overview, alignment/difference bullets)
- "What HAEVN thinks you should know" (3 fields)
- "Potential conversation starters" (list)

No masthead, no photo, no Profile at a Glance, no About, no §04, no §05, no
verdict strip, no per-category static explainers, no disclosure pattern.

### 2.2 The AI layer

- **Model:** `gpt-4o-mini`, `temperature 0.3`, `max_tokens 2000`,
  `response_format: json_object`, raw fetch (no SDK).
  [`lib/ai/generateMatchInterpretation.ts`](../../lib/ai/generateMatchInterpretation.ts)
- **Prompt:** [`lib/ai/prompts/matchInterpretation.ts`](../../lib/ai/prompts/matchInterpretation.ts) —
  the client's AI-doc rules 1–17 verbatim + a folded output contract. **6,872 chars ≈ 1,763 tokens.**
- **Schema + validator:** [`lib/ai/matchInterpretationSchema.ts`](../../lib/ai/matchInterpretationSchema.ts) —
  hard-fails on structural breakage, coerces everything the AI doc marks omittable.
- **Current JSON shape:**
  ```
  match_summary                        string (35–55 w)
  executive_summary                    string (45–70 w)
  strongest_areas                      [{category, summary}] × 3
  nudge_compatibility_highlights       [string] × 3
  sections                             × 5 { category, classification, overview,
                                             alignments[≤3], differences[≤2],
                                             interpretation }
  what_haevn_thinks_you_should_know    { strongest_reason, most_meaningful_difference,
                                         haevn_assessment (90–140 w) }
  conversation_starters                [string] × 3–5
  ```
- **Cache / invalidation:** [`lib/matches/getMatchInterpretation.ts`](../../lib/matches/getMatchInterpretation.ts).
  Keyed `(viewer_partnership_id, match_partnership_id)`. Fresh iff **both**
  `engine_version` and `source_computed_at` match the live `computed_matches`
  row — so Monday's recompute invalidates everything automatically. On any
  failure it degrades to deterministic sections with `payload: null`; the card
  always renders. `cacheOnly` for list views so a page never blocks on N
  generations. Warm cron `/api/cron/warm-interpretations` (Mon 13:00 UTC, between
  recompute and notify), flag `INTERPRETATION_WARM_ENABLED`, default OFF.

### 2.3 🔴 Blocker — `match_interpretations` is not in production

```
select('*')   → ❌ Could not find the table 'public.match_interpretations'
select('id')  → ❌ Could not find the table 'public.match_interpretations'
```

`supabase/migrations/052_match_interpretations.sql` exists in the repo. Tables
from `050`, `051`, `053`, `054`, `055`, `056`, `057` all exist and hold data.
**Only 052 is missing.** Consequences:

- no interpretation has ever been cached, in any environment;
- `getMatchInterpretation` degrades on *every* call — silently, by design;
- the warm cron would fail on every row if its flag were turned on;
- `interpretation_warm` events in `system_events`: **0**, consistent with this.

*Correction to the 2026-09-20 state-of-systems snapshot: it reported
"match_interpretations rows: 0". That was a swallowed PostgREST error, not an
empty table. The table does not exist.*

### 2.4 Category mapping — ✅ already 1:1, no mismatch

[`lib/matches/sectionMapping.ts`](../../lib/matches/sectionMapping.ts):

| Engine category | Display name | Reference name | |
|---|---|---|---|
| `intent` | Goals & Expectations | Goals & Expectations | ✅ |
| `structure` | Structure Fit | Structure Fit | ✅ |
| `connection` | Emotional & Communication | Emotional & Communication | ✅ |
| `chemistry` | Sexual Compatibility | Sexual Compatibility | ✅ |
| `lifestyle` | Practical Fit | Practical Fit | ✅ |

Nothing to rename, nothing to confirm with the client. `SECTION_DISPLAY_NAMES`
is already the contract the validator enforces.

**Band vocabulary — needs a decision.** `scoreToBand` emits five labels
(*Exceptional Alignment / Strong Alignment / Compatible / Some Differences /
Meaningful Difference*). The reference pill shows **`STRONG`** and
**`COMPATIBLE`** — uppercase, single-word. Either the pill renders a short form
of the existing band or the client wants a different vocabulary. Low-risk;
flag for confirmation, do not change `scoreToBand`.

---

## 3. Gap table

`exists` · `restyle` = exists, needs restyling · `new-static` = new copy in code ·
`new-AI` = new pair-specific AI field · `new-data` = blocked on data.

| # | Reference element | Current | Class | Note |
|---|---|---|---|---|
| H1 | Masthead / ref id / back link | — | **new-static** | `REF · M-00xx` needs a stable per-pair display id |
| H2 | Photo | card only | **new-data** | 51/757 live have a photo (**6.7%**) |
| H3 | Distance badge | `distance_miles` plumbed, never populated | **new-data** | lat/long **0/757**; see §6 |
| H4 | Name, age | exists | restyle | age **52.4%** |
| H5 | Verified shield + Veriff line | — | **new-data** | `is_verified` **0/757**, `verification_status` `none` ×757 |
| H6 | HAEVN+ badge | tier known | **new-static** | 18 of 757 live are `plus` |
| H7 | Title `Your N% Match with X.` | exists | restyle | |
| H8 | Header sub-paragraph | `match_summary` | exists | reuse as-is |
| H9 | Match ring | numeric only | restyle | |
| H10 | Threshold `80% minimum` | `MATCH_MIN_SCORE = 80` | **new-static** | true for matches; recs store at 77 |
| P1 | Profile at a Glance — gender | `identity` | exists | **52.4%** |
| P2 | — age | `age` | exists | **52.4%** |
| P3 | — **pronouns** | **no column** | **new-data** | not in `partnerships` at all |
| P4 | — orientation | `orientation` | exists | 100% |
| P5 | — location | `city` (+`state` 52%) | restyle | `Austin, TX` needs state |
| P6 | — structure | `structure` | exists | 100% |
| S1 | §01 About | `short_bio` | **new-data** | `short_bio`/`long_bio` **0/757**; `connection_summary` 48.7% |
| S2 | §02 three paragraphs | `executive_summary` (1) | **new-AI** | needs 3 fields, not 1 |
| S3 | §03 standfirst + intro | — | **new-static** | |
| S4 | §03 category name/score/band/bar | exists | restyle | |
| S5 | §03 category summary | `sections[].overview` | exists | reuse |
| S6 | §03 `WHAT THIS MEASURES` ×5 | — | **new-static** | code, never in the AI call |
| S7 | §03 `WHY IT MATTERS` ×5 | — | **new-static** | same |
| S8 | §03 `YOUR ALIGNMENT` ×5 | `alignments[]` bullets | **new-AI** | bullets → prose paragraph |
| S9 | §03 `WHERE YOU DIFFER` ×5 | `differences[]` bullets | **new-AI** | bullets → prose paragraph |
| S10 | §03 `HAEVN'S READ` ×5 | `sections[].interpretation` | exists | reuse |
| S11 | §03 disclosure toggle | always-open | restyle | |
| S12 | §04 Worth Talking About | — | **new-AI** | 3 items + closing |
| S13 | §05 The Signals That Mattered | `nudge_compatibility_highlights` (3) | **new-AI** | needs **6** chips |
| S14 | §06 Conversation Starters | `conversation_starters` | exists | reuse |
| S15 | Closing verdict strip | — | **new-AI** | `N% MATCH · <VERDICT>` |
| S16 | Closing paragraph | `haevn_assessment` (90–140 w) | restyle | reference reads ~40 w |
| S17 | End-of-report footer | — | **new-static** | sample-only; omit in-app |

**Totals:** 8 exists · 7 restyle · 8 new-static · 7 new-AI · **6 new-data**.

The unblocked work is small. **The six `new-data` rows are the project.**

---

## 4. Schema design

### 4.1 Principles

1. Static category copy (`WHAT THIS MEASURES`, `WHY IT MATTERS`) lives in
   `lib/matches/categoryCopy.ts` — 10 strings, **never** in the AI call. They are
   identical for every pair; paying to regenerate them 2,200×/week would be
   absurd and would let the model drift on a definitional statement.
2. One consolidated call per pair-direction. Cached. Invalidated by the existing
   `engine_version` + `source_computed_at` rule.
3. Additive to the existing payload. `schema_version` goes `v1` → `v2`;
   `getMatchInterpretation` treats a `v1` row as stale.

### 4.2 Proposed `payload` (v2) — deltas marked

```jsonc
{
  "match_summary":      "…",      // KEEP — header sub-paragraph
  "executive_summary":  "…",      // KEEP — fallback/list teaser

  "why_this_introduction": {      // NEW — §02, three paragraphs
    "what_aligns":    "…",        //   45–65 w
    "what_differs":   "…",        //   45–65 w
    "the_verdict":    "…"         //   25–40 w
  },

  "sections": [ {                 // KEEP shape, ADD two prose fields
    "category":       "…",
    "classification": "…",
    "overview":       "…",        // KEEP — collapsed summary
    "your_alignment": "…",        // NEW  — 45–65 w prose (replaces alignments[] in UI)
    "where_you_differ": "…",      // NEW  — 45–65 w prose (replaces differences[] in UI)
    "interpretation": "…",        // KEEP — renders as HAEVN'S READ
    "alignments":  ["…"],         // KEEP for one release, then drop
    "differences": ["…"]          // KEEP for one release, then drop
  } ],

  "worth_talking_about": {        // NEW — §04
    "items":   ["…", "…", "…"],   //   exactly 3, ≤14 w each
    "closing": "…"                //   25–35 w
  },

  "signals_that_mattered": ["…"], // NEW — §05, exactly 6 chips, 2–4 w each

  "conversation_starters": ["…"], // KEEP — 3–5

  "closing_read": {               // NEW — verdict strip + paragraph
    "verdict":   "INTRODUCTION RECOMMENDED",  // enum, see below
    "statement": "…"                          // 35–50 w
  },

  "what_haevn_thinks_you_should_know": { … },  // KEEP — powers list/nudge surfaces
  "nudge_compatibility_highlights": ["…"]      // KEEP — separate surface
}
```

**`closing_read.verdict` must be a closed enum**, not free text — it is a
verdict, and a model that invents "STRONG INTRODUCTION RECOMMENDED" would break
the strip. Propose deriving it from the band in code and having the model echo
it, exactly as `classification` works today (model echoes, app ignores).

### 4.3 Validator changes

Hard-fail (breaks the render): the three `why_this_introduction` fields; per
section `your_alignment` + `where_you_differ`; exactly 3 `worth_talking_about.items`;
exactly 6 `signals_that_mattered`; `closing_read.statement`.
Coerce (safe default): `closing_read.verdict` → derived-in-code value;
`worth_talking_about.closing` → `''`. The existing `dropUnknowns` filter must be
applied to the two new prose fields too — a "not specified" sentence must never
reach `WHERE YOU DIFFER`.

### 4.4 Cost — measured, not guessed

Prompt measured from the real builder with two full survey profiles and five
category results (`~3.9 chars/token`, gpt-4o tokenizer average):

| | input tokens | output tokens | $/call | 1,100 pairs | **2,200 directions** |
|---|---|---|---|---|---|
| current | 4,363 | 1,934 | $0.00181 | $2.00/wk | **$3.99/wk** |
| **proposed v2** | 4,713 | 1,795 | $0.00178 | $1.96/wk | **$3.92/wk** |

`gpt-4o-mini` @ $0.15/1M in, $0.60/1M out.

**≈ $3.92/week. Two orders of magnitude under the $50 flag.** Annualised ≈ $204.

The proposed output is *slightly smaller* than current: the reference's single
prose paragraph per field costs fewer tokens than today's `alignments[≤3]` +
`differences[≤2]` arrays. **One consolidated call is correct; no split needed.**

⚠️ **One required change:** `max_tokens` is **2000** and the proposed output
estimates **~1,795**. That is a 10% margin, and a long `haevn_assessment` would
truncate mid-JSON → `MALFORMED_JSON` → silent degrade. **Raise to 3,000.** Cost
impact is nil (billed on actual, not cap).

---

## 5. Redaction design

Today's transform ([`lib/matches/redactMatchCard.ts`](../../lib/matches/redactMatchCard.ts))
nulls `display_name`, `first_name` → `D***`, `photo_url`, `short_bio`,
`connection_summary` for free viewers, and returns the paid payload referentially
unchanged. That contract holds and must be extended field-by-field to the report.

### 5.1 Field list for the report

| Field | Free viewer | Rationale |
|---|---|---|
| Photo | **hidden** (silhouette) | existing rule |
| Name in header/title | **`D***`** | existing rule |
| Name inside AI prose | **never present** | prompt rule 1 — the model is told to write "this person"; `first_name` is stripped before it reaches the model for free viewers |
| Age | **shown** | non-identifying demographic |
| Gender / orientation / structure / pronouns | **shown** | same |
| Location | **city only**, never `city, ST` | see §6.4 |
| Distance / proximity label | **banded only** | never a precise figure |
| HAEVN+ badge | **shown** | about them, not identifying |
| Verified shield + Veriff line | **shown** | 🔶 **decision — recommend shown**: it is a HAEVN assertion about trust, carries no identity, and is a core reason to pay. Hiding it weakens the upgrade case. |
| **§01 About** | **hidden, replaced by gate** | 🔶 **decision — recommend hidden**: free-text bio is the classic re-identification vector (employer, neighbourhood, handles), and `short_bio` is already nulled today. Consistent with the existing contract. |
| §02 Why HAEVN Made This Introduction | **shown** | analysis, not identity |
| §03 all five categories, all five detail fields | **shown** | this is the product |
| §04 Worth Talking About | **shown** | analysis |
| §05 Signals That Mattered | **shown** | but see risk below |
| §06 Conversation Starters | 🔶 **recommend hidden** | starters reference specifics ("you both mentioned the outdoors") and are an *action* surface — the natural paid payoff |
| Closing HAEVN'S READ | **shown** | analysis |

⚠️ **Re-identification risk in §05.** The reference's chips include
**`Austin-based`**. A location chip inside a section that is visible to free
viewers leaks geography that the header deliberately bands. **The chip generator
must be constrained to the five engine categories and forbidden from emitting
location, employer, or demographic chips** — the same constraint the prompt
already applies to the section bodies ("Do NOT introduce observations drawn from
demographics").

### 5.2 Gate placement

Per the client's established model — **analysis visible, identity gated**:

```
[header: silhouette + D*** + age + ring + band]
[Profile at a Glance — demographics only]
[§01 About ······················· 🔒 gated]
[§02 Why HAEVN Made This Introduction ✓]
[§03 Compatibility Breakdown — all 5, fully expandable ✓]
[§04 Worth Talking About ✓]
[§05 The Signals That Mattered ✓]
        ┌──────────────────────────────────┐
        │  Become a HAEVN+ member          │  ← after the analysis
        │  See who this is, their photo,   │
        │  and how to start the conversation│
        └──────────────────────────────────┘
[§06 Conversation Starters ······· 🔒 gated]
[Closing HAEVN'S READ ✓]
```

The member reads the entire analysis, hits the wall exactly where the value
turns from *understanding* into *acting*. Paywall body copy is a **separate
surface** and is not invented here — see §9.

### 5.3 Test obligation

`hasNoIdentityLeak` must be extended to assert the report payload carries no
`about` text, no photo URL, no full name, no precise location, and no location
chip in `signals_that_mattered`. This is an API-level test, not a UI test.

---

## 6. Distance

### 6.1 The data

| | live partnerships |
|---|---|
| `latitude` NOT NULL | **0 / 757 (0.0%)** |
| `longitude` NOT NULL | **0 / 757 (0.0%)** |
| `zip_code` (valid 5-digit) | 397 / 757 (**52.4%**) |
| `city` NOT NULL | 757 / 757 (**100%**) |
| `state` NOT NULL | 394 / 757 (52.0%) |
| `msa` NOT NULL | **0 / 757** |

`distance_miles` is already plumbed through `getMatchCardData` and rendered as
`"{n} miles away"` — it has simply never had a value.

### 6.2 Pair geography (1,100 live rows)

| | pairs | share |
|---|---|---|
| same city string | 134 | **12.2%** |
| different city string | 966 | **87.8%** |

⚠️ This is **cross-*city***, and much higher than the 46% cross-*market* figure
in the all-markets plan. Only about one pair in eight is same-city. A
proximity-led header is wrong for ~88% of the product.

### 6.3 Verdict

**True miles cannot ship, and should not be faked.** `"4 miles away"` requires
per-member coordinates. Zip-centroid distance would be honest to roughly ±5 miles
— but only for the 52.4% with a zip, and only for the 12.2% where it is a
meaningful number at all.

**Ship at launch — a location line, not a distance badge:**

| Condition | Renders | Coverage |
|---|---|---|
| same city | `Both in Austin` | 12.2% |
| different city, both known | `Austin ↔ Portland` | 87.8% |
| viewer's city unknown | `Portland` (match's city only) | — |
| neither known | line omitted entirely | 0% today |

City is 100% populated, so this line always renders.

**Later, behind a backfill:** geocode `zip_code` → lat/long (**397 rows have a
zip; 757 need coordinates**), then render a *banded* proximity
(`Under 5 miles` / `About 15 miles` / `Under 50 miles`) — never a precise figure
for a free viewer. A zip-centroid backfill is a static dataset join, no paid
geocoding API required. **Not on this project's critical path.**

### 6.4 Cross-market disclosure — design it in here

The location line is the natural home for the disclosure flagged in the
all-markets plan. When the two cities differ:

```
📍 Austin ↔ Portland
   HAEVN matches across cities. You may be introduced to someone
   outside your metro.
```

One sentence, attached to the line that already states the fact, shown only when
the cities differ (≈88% of pairs). This closes the all-markets disclosure gap
without inventing a new surface. **Exact wording is the client's to approve** —
the sentence above is a placeholder describing intent, not approved copy.

---

## 7. Mobile

Reference at 390px: **11,858px tall** (1.5× the desktop height). Captures:
[`mobile-header.jpg`](../specs/match-report-reference/mobile-header.jpg),
[`mobile-category.jpg`](../specs/match-report-reference/mobile-category.jpg).

Observed behaviour:

- the desktop two-column grid (category meta left / summary right) **collapses to
  one column**; summary drops below the score bar;
- header photo goes full-width, overlays stay anchored;
- Profile at a Glance reflows from a 6-across row to a 2-across grid;
- section numbers (`§ 03`) stack above the heading rather than sitting inline;
- type scale holds — body stays ~16px, headings shrink.

**Approach for the app.** Build mobile-first single-column; treat the desktop
two-column category block as the enhancement at `md:`. Three things matter:

1. **Disclosures start collapsed.** An 11,858px document with everything open is
   not navigable on a phone. Collapsed, the member scans five scores and opens
   what they care about. This also makes the gate position stable.
2. **The ring and band must be legible without the right column** — they carry
   the summary judgement on their own.
3. **Entry point.** The card links into this document; it should land on the
   header, not deep-link to a category. A sticky mini-header (name token + score)
   on scroll is worth considering but is not required for v1.

---

## 8. Build sequence — 3 PRs

Everything is flag-gated. Nothing member-facing changes until the client has
approved real generated samples.

### PR-1 — Foundation: migration 052 + schema v2 + static copy + samples

*No UI. Nothing member-facing.*

- Apply **`052_match_interpretations`** to production. Confirm the table exists
  and `getMatchInterpretation` caches.
- `lib/matches/categoryCopy.ts` — the 10 static strings (`WHAT THIS MEASURES`,
  `WHY IT MATTERS` × 5), transcribed verbatim from the reference.
- Extend prompt + schema + validator to v2 (§4.2/4.3). `SCHEMA_VERSION` → `v2`.
- `max_tokens` 2000 → **3000**.
- Extend `/api/admin/match-interpretation-sample` to emit full v2 payloads.
- **Generate ~10 real samples across the score range and hand them to the client.**

**Gates:** `npm run build`; full suite; validator unit tests for every new
hard-fail and coercion; `tsc` at the 313 baseline; measured cost per call within
20% of the $0.00178 estimate; **zero member-facing diff** (no page touched).

**Exit:** client approves the generated prose. This is the real checkpoint —
everything after is presentation.

### PR-2 — The document UI, flag-gated

- New route/component rendering the full structure, mobile-first.
- Static chrome, Profile at a Glance, all six sections, disclosures, verdict strip.
- Location line + cross-market disclosure (§6.3/6.4).
- Redaction extended per §5.1; `hasNoIdentityLeak` extended per §5.3.
- Behind `MATCH_REPORT_V2_ENABLED`, default **off**. Old breakdown remains live.

**Gates:** build + suite; redaction tests proving no identity/location leak for a
free viewer at the API layer; visual check at 390 / 768 / 1440; the old breakdown
byte-identical with the flag off.

### PR-3 — Backfills and flag-on

- Enable `INTERPRETATION_WARM_ENABLED` so Monday's cron pre-generates.
- Whatever the client resolves from §9 (photos, verification, bios).
- Flip `MATCH_REPORT_V2_ENABLED` after a staged check.

**Gates:** warm cron completes inside its 300s budget at ~2,200 directions
(currently unmeasured — **measure in PR-1**); cache hit rate on the Monday after;
actual weekly spend against the $3.92 estimate.

---

## 9. Client inputs

### 🔴 Blocking — the report cannot look like the reference without these

| # | Input | Why blocking |
|---|---|---|
| 1 | **Photos.** 51/757 live members (6.7%) have any photo. | The header is photo-led. At 6.7%, 93% of reports render a silhouette. A product decision (prompt for photos? redesign the header for photoless?), not an engineering one. |
| 2 | **Verification.** `is_verified` 0/757; `verification_status` `none` ×757. Veriff is integrated but nobody has completed it. | `VERIFIED — Identity confirmed via Veriff` is a headline trust signal with zero data. Either drive verification or cut the line. |
| 3 | **Bios.** `short_bio` and `long_bio` are **0/757**. | §01 *About* has no source. Options: (a) cut §01 for v1; (b) generate it from survey data as a new AI field; (c) prompt members for a bio. `connection_summary` exists at 48.7% but is a *pair* summary, not a biography — wrong content for this slot. **Recommend (a) for v1, (c) as the real fix.** |

### 🟡 Non-blocking — needs an answer before PR-2 ships

| # | Input |
|---|---|
| 4 | **Pronouns.** No column in `partnerships`. Add to onboarding, or drop the field from Profile at a Glance. |
| 5 | **Band pill vocabulary.** Reference shows `STRONG`/`COMPATIBLE`; `scoreToBand` emits *Strong Alignment*/*Compatible*. Short form of the existing labels, or a new vocabulary? Do not change `scoreToBand` without an answer. |
| 6 | **`closing_read.verdict` enum.** Reference shows `INTRODUCTION RECOMMENDED`. Need the full set for every band. |
| 7 | **`REF · M-0084`.** Is the report reference id a real member-facing artifact, and what generates it? |
| 8 | **Cross-market disclosure wording** (§6.4). Placeholder written; needs approval. |
| 9 | **Score expectations.** ⚠️ Live scores are **77–81, median 77** (979/1000 in the 75–79 band, max 81). The reference shows 84% with categories 73–96. Near-every real report will read ~77–80%. The client should see this before approving a design whose visual language assumes a wider spread. |

### 🟢 Not blocking

- **The client's AI prompt.** Rules 1–17 are already transcribed verbatim into
  `MATCH_INTERPRETATION_SYSTEM` and the per-field length limits are encoded. The
  new v2 fields need output-contract lines in the same house style; his prompt
  would be a *cross-check*, not an input. **Nice-to-have, not blocking.**
- **Paywall body copy.** Confirmed a **separate surface**. The gate's placement
  is designed here (§5.2); its words are not invented. PR-2 ships a placeholder
  behind the flag.

---

## 10. Open risks

1. **Migration drift.** 052 missing while 053–057 applied means migrations are not
   being applied in order or by a single process. Worth understanding before
   PR-1 applies 052, or the next one goes missing too.
2. **Warm-cron budget unmeasured.** 2,200 directions × ~2s ≈ 73 min sequential,
   against a 300s ceiling. The cron already limits itself to viewers who have
   logged in (173 users), so real volume is far lower — **but it has never run**.
   Measure in PR-1 before enabling.
3. **`alignments[]`/`differences[]` dual-write.** Keeping them one release costs
   ~200 output tokens/call (~$0.40/wk). Cheap insurance; drop in PR-3.
4. **Score compression** (§9.9) is a product risk, not a technical one, but it
   determines whether this document reads as impressive or as thin.
