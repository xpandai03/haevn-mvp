# Match Card + Compatibility Breakdown Rebuild — Implementation Plan

**Status:** AWAITING APPROVAL — hard stop before any UI is written.
**Design source of truth:** `Match cards Revised.pdf` (visual, 3 states + expanded view) and `Updated Match Card Prompts (1).pdf` (AI copy spec — authoritative on all copy, tone, JSON field names, and length limits).
**Product thesis:** the *why* is free (full five-section analysis); identity + connection are the HAEVN+ upgrade.

---

## 1. Recon findings

### (a) Engine breakdown — `computed_matches.breakdown` (`engine_version: 5cat-v6`)
Stored as an **array of 5 category objects**, each:
```
{ category, score (0-100), weight, coverage (0-1), included, subScores:[ {key, score, reason, weight, matched, effectiveWeight} ] }
```
The five engine categories map **1:1** to the five design sections — a clean rename, **no gaps, no fabricated numbers required**:

| # | Engine `category` | Weight | subScore keys | → Design section |
|---|---|---|---|---|
| 1 | `intent` | 30 | goals, style, exclusivity, attachment, timing, privacy, haevnUse | **Goals & Expectations** |
| 2 | `structure` | 20 | orientation, status, boundaries, saferSex, roles, fidelity | **Structure Fit** |
| 3 | `connection` | 25 | attachment, communication, emotional, privacy, emotionalPace, emotionalEngagement | **Emotional & Communication** |
| 4 | `chemistry` | 10 | eroticProfile, rolesKinks, frequency, boundaries, physicalPreferences, exploration | **Sexual Compatibility** |
| 5 | `lifestyle` | 15 | distance, privacy, socialEnergy, substances, languages, independenceBalance, lifestyleImportance, cultural, children, dietary, pets, ageRange | **Practical Fit** |

Each category's `score` is the per-section score (progress bar + band). Overall `computed_matches.score` = the Match Score. `subScores[].reason` are deterministic engine-written strings (e.g. "Different attachment patterns") — safe, engine-supplied context to feed the AI. `coverage` flags how much data backed each category (used for graceful degradation, below).

> ⚠️ **Do NOT reuse the existing `CATEGORY_DISPLAY_MAP`** in `lib/actions/computedMatchCards.ts:59`. It renames `connection→boundaries_comfort` and `lifestyle→openness_curiosity` — a stale, semantically-wrong scheme, and it flattens the array to score-only (drops `subScores`). The new data layer reads the **raw breakdown array** directly.

### (b) AI infrastructure — already exists, mirror it
- **Provider:** raw `fetch` → OpenAI `gpt-4o-mini`, keyed by `OPENAI_API_KEY`. Reference impl: `lib/ai/generateSummaries.ts` (temp 0.3, fallback classification: `NO_API_KEY` / `AI_QUOTA_EXCEEDED` / `AI_UNAVAILABLE`). **No new dependency needed** (the `@anthropic-ai/sdk ^0.80.0` in package.json is dead/unused; `ANTHROPIC_API_KEY` is not configured).
- **AI-safe per-member assembler already built:** `buildSummaryInput(answers, displayName)` in `lib/ai/buildSummaryInput.ts` → `{first_name, age, relationship_intent, relationship_structure, social_style, communication_style, dating_pace, lifestyle_rhythm, values[], interests[]}`. Deterministic, **leaks no raw question IDs/scores, maps kink/erotic content to safe generalized labels**. This is exactly the interpreter's per-member input.
- **Cache precedent:** migration `033_ai_summaries.sql` added versioned+timestamped columns (`summaries_version`, `summaries_generated_at`) to `partnerships`. Same versioning convention, but our artifact is **per-pair-direction**, so it needs its own table (below).
- Recompute cron does **not** call any LLM — clean to add a warm pass without touching scoring.

### (c) Card components — what survives
- Live member match UI is under `/dashboard`. `ProfileCard.tsx` is one component with variants `match`/`connection`/`nudge`; the list pages (`app/dashboard/matches/page.tsx`, `recommendations`, `nudges`, `connections`) all render it. The detail route `app/dashboard/matches/[id]/page.tsx` is bespoke with an inline accordion — closest to today's "breakdown."
- Fetch path: `getComputedMatchCards()` / `getRecommendationCards()` in `lib/actions/computedMatchCards.ts` → `ComputedMatchCard`.
- **Reusable:** the fetch/query plumbing, tier gate (`getUserMembershipTier` + `canAccessConnection` at `lib/connections/canAccessConnection.ts:19`), lucide icons, `dash-card`/`haevn-*` CSS primitives, `ReadyToMeetButton`, the handshake/nudge/hidden server-actions, the unlocked full-profile shape (`lib/connections/getConnections.ts:30-90`).
- **Replace:** `ProfileCard`'s `match`-variant markup, the inline accordion in `[id]/page.tsx`, and the redaction approach.

### (d) Redaction — CRITICAL vulnerability (client-side only)
`getComputedMatchCards()` attaches the matched member's **real `display_name`, `first_name`, and resolved public `photo_url` to every card regardless of viewer tier** (`computedMatchCards.ts:443-452` name, `:370-374`/`:449` photo). Masking is done in the browser (`ProfileCard.redactName()`, silhouette swap). **A free viewer's browser receives the full name + photo URL in the payload.** No server-side redactor exists. Acceptance criterion (2) targets exactly this — fixed in PR-A.

### (e) Nudges + survey
- **`nudges`** table (`016_phase3_schema.sql`): `{id, sender_id (auth.users), recipient_id (auth.users), created_at, read_at, UNIQUE(sender,recipient)}`. Keyed on **auth user IDs**, direction sender→recipient, no status enum (only `read_at`). "This match nudged the viewer" =
  `nudges WHERE sender_id = <matchOwnerUserId> AND recipient_id IN (<viewer member user_ids>)`.
  Read helpers exist (`getReceivedNudges`, `hasNudgedUser` in `lib/actions/nudges.ts`). Table is effectively empty → **nudged state ships dark until data exists** (matches scope). The "92%" on the nudged card is the real `computed_matches.score`, not the stubbed `80`.
- **Survey:** `user_survey_responses` (PK `user_id`, `answers_json` JSONB, `completion_pct`); a partnership's answers = first member with `completion_pct >= 100`. DB→engine plumbing to reuse: `lib/services/computeMatches.ts:411-451`; question→category map: `lib/matching/constants/questionMappings.ts`. `isCouple = profile_type === 'couple'`.
- **Demographics line** ("Man · Straight · Monogamous", "35", "4 miles away"): `partnerships.{profile_type, identity, orientation, structure, age}` + banded distance from `latitude/longitude` (`032`). Fields to **redact for free tier:** `display_name`, all `partnership_photos` URLs, exact `lat/long` (send banded distance only), employer/handles in bios.

---

## 2. Section mapping + classification (app-owned, zero AI)

`lib/matches/sectionMapping.ts` (new, pure, unit-tested):
- `SECTIONS`: ordered array of `{ engineCategory, key, displayName, icon, order }` per the table in §1.
- `scoreToBand(score)` → `{ band, label, colorToken }` using the **authoritative bands**:

| Band | Range | Label string | Color |
|---|---|---|---|
| exceptional | 90–100 | "Exceptional Alignment" | teal-strong |
| strong | 80–89 | "Strong Alignment" | teal |
| compatible | 70–79 | "Compatible" | green |
| some_differences | 60–69 | "Some Differences" | amber |
| meaningful_difference | <60 | "Meaningful Difference" | red |

All per-section scores, bands, labels, colors, progress-bar fills, and the overall Match Score come **only** from engine data. The AI never sees a blank score to fill and never returns a number we render (see §3, `classification` is echoed-only).

---

## 3. AI interpretation layer

### Contract — one consolidated structured-JSON call per pair-direction (viewer→match)
The AI doc specifies per-field prompts; architecturally we issue **one call** returning the full object (shared input context → cheaper, more coherent, atomically cacheable). Every copy rule, length limit, and field name from the doc is preserved inside that one system prompt. Model receives: `buildSummaryInput(viewer)`, `buildSummaryInput(match)` **(first_name stripped for free viewers — defense in depth)**, the engine's 5-category breakdown incl. `subScores[].reason` + `coverage`, the app-computed `classification` per section, `nudge_status`, `membership_status`. Response validated against the schema; malformed → reject → degrade.

### JSON schema (`lib/ai/matchInterpretationSchema.ts`)
```jsonc
{
  "match_summary": "string",            // free card "Why HAEVN matched you" · 35–55 words · no identity, no score digits
  "executive_summary": "string",        // expanded top "Your N% Match" · 45–70 words
  "strongest_areas": [                   // exactly 3 · free-card top-3
    { "category": "string", "summary": "string (≤16 words)" }
  ],
  "nudge_compatibility_highlights": ["string ≤8 words", "…", "…"],  // 3 · rendered only in nudged state
  "sections": [                          // exactly 5, engine order
    {
      "category": "Goals & Expectations|Structure Fit|Emotional & Communication|Sexual Compatibility|Practical Fit",
      "classification": "string",        // ECHOED from app-provided band; APP IGNORES this and renders its own
      "overview": "string (25–45 words)",
      "alignments": ["string", … max 3],
      "differences": ["string", … max 2],   // [] if none meaningful — never manufactured
      "interpretation": "string (25–50 words, omit if nothing useful)"
    }
  ],
  "what_haevn_thinks_you_should_know": {  // the "comparison engine → matchmaker" synthesis
    "strongest_reason": "string",
    "most_meaningful_difference": "string",
    "haevn_assessment": "string (90–140 words)"
  },
  "conversation_starters": ["string ≤12 words", … 3–5]
}
```
Validator enforces: all 5 sections present + category names exact; array cardinalities; non-empty required strings; word-count soft-checks (warn, not reject). `classification` is **echoed only** — the app always renders its own `scoreToBand` output, so the AI can never alter a classification.

### Copy/tone rules carried verbatim from the AI doc
Global rules 1–17 (viewer POV / "you" + "this person"; never invent compatibility; never reveal identity for free members; no generic dating language; explain *why* a difference matters; distinguish alignment vs compatible-difference vs meaningful-difference vs **unknown/unanswered**). **Sexual Compatibility (doc §9):** never claim chemistry/attraction/"good sex"; describe only expectations & preferences from supplied dimensions; neutral, non-sensational — reinforced by `buildSummaryInput`'s safe labels. **Unknown ≠ difference:** subScores with `matched:false` / "not specified" (e.g. `exclusivity` score 0 from unanswered data) are passed with their reasons so the model treats them as unknown, never as incompatibility. **Coverage-aware:** when a category's `coverage` is low, the section degrades to "limited data" framing rather than rich prose.

### Graceful degradation (mandatory)
A failed/pending/malformed generation **never blocks and never breaks the card**. The card and breakdown always render from deterministic data (per-section score + band + engine `reason` strings); AI prose hydrates when ready. No blocking spinner — first view shows deterministic content immediately, AI copy fills in on completion or on next load from cache.

---

## 4. Cache design + cost

### Storage — new table (migration `~052`, confirm next number at impl)
```sql
match_interpretations (
  id uuid pk,
  viewer_partnership_id uuid not null,   -- direction: written to "you" = viewer
  match_partnership_id  uuid not null,
  engine_version text not null,          -- from computed_matches.engine_version
  source_computed_at timestamptz not null, -- freshness key vs the live row
  model text not null,                   -- 'gpt-4o-mini'
  schema_version text not null default 'v1',
  payload jsonb not null,                -- the validated object from §3
  generated_at timestamptz not null default now(),
  unique (viewer_partnership_id, match_partnership_id)
)
```
- **Read:** look up by (viewer, match); serve if `engine_version` + `source_computed_at` match the live `computed_matches` row. Stale/missing → generate + upsert (cache-fill on demand). Directional: (A→B) and (B→A) are distinct rows.
- **Invalidation:** Monday recompute rewrites `computed_matches` (new `computed_at`/`engine_version`) → existing interpretations read as stale → regenerate. We do **not** FK-cascade to `computed_matches.id` (avoids a delete race during the weekly rewrite window and keeps rows for analytics).
- **Warm pass (optional, flagged off):** a post-recompute cron over released pairs to pre-fill the cache and remove first-view latency. MVP = on-demand cache-fill + degradation; warm cron behind `INTERPRETATION_WARM_ENABLED`.

### Cost (gpt-4o-mini: $0.15/1M in, $0.60/1M out)
- Per pair-direction: ~3,100 input + ~1,500 output tokens ≈ **$0.0014**.
- Current volume: **377 released directional pairs** (117 viewers, avg 3.2 each) → **~$0.52/recompute cycle (~$2/month)**.
- 10× scale (~3,800 pairs) → ~$5/cycle (~$21/month). Negligible either way. On-demand-only (no warm pass) generates just what's viewed — strictly cheaper.

---

## 5. Component tree

**Data/AI layer (PR-A)**
- `lib/matches/sectionMapping.ts` — mapping + bands (pure, tested).
- `lib/matches/getMatchCardData.ts` — tier-aware, **server-side-redacted** payload assembler for one match (score, 5 sections w/ bands, resolved state, AI interp via cache, redacted identity).
- `lib/matches/nudgeState.ts` — "did match nudge viewer" query.
- `lib/actions/computedMatchCards.ts` — **move name/photo redaction server-side** (fix the leak at `:370-374`, `:443-452`); the list benefits too.
- `lib/ai/prompts/matchInterpretation.ts` — system prompt (doc rules verbatim).
- `lib/ai/matchInterpretationSchema.ts` — schema + validator + types.
- `lib/ai/generateMatchInterpretation.ts` — consolidated call (mirrors `generateSummaries.ts`), failure classification.
- `lib/matches/getMatchInterpretation.ts` — cache read → freshness check → generate/upsert → degrade.
- migration `~052_match_interpretations.sql`.

**UI layer (PR-B)**
- `components/matches/MatchCard.tsx` — three states (standard / nudged / unlocked). Replaces `ProfileCard` match-variant markup; gated so **recommendations stay on the old path untouched**.
- `components/matches/{MatchScoreRing, AlignmentBadge, RedactedIdentity (D***, silhouette), SectionRow, CompatibilityBreakdown}.tsx`.
- `app/dashboard/matches/[id]/breakdown/page.tsx` — expanded view: left summary card + right 5-section detail + legend + "What HAEVN thinks you should know" + conversation starters + sticky upgrade bar (free viewers). **Desktop two-column; stacks on mobile.**
- Wire `app/dashboard/matches/page.tsx` list → new `MatchCard`.

---

## 6. State matrix (viewer's perspective)

| State | Trigger | Photo | Name | Analysis | Extra | CTA (label · style) | CTA target |
|---|---|---|---|---|---|---|---|
| **Standard free** | tier=`free`, no nudge, not connected | blurred/silhouette | `D***, 35` | full 5 sections + `match_summary` + top-3 `strongest_areas` | "This is one of your strongest matches" headline | 🔒 "SEE WHO YOUR N% MATCH IS" · gold | `/onboarding/membership` |
| **Nudged free** | tier=`free`, nudge row (match→viewer) exists, not connected | blurred + heart | `D***, 35` | full 5 + 3 `nudge_compatibility_highlights` | banner "SOMEONE WANTS TO MEET YOU" + "They already made the first move" | 🔒 "SEE WHO NUDGED YOU" · gold | `/onboarding/membership` |
| **Unlocked** | tier≠`free` (HAEVN+) | real photo | real name | full 5 + overall badge | "STRONG MATCH" badge | 💬 "SEND A MESSAGE" · teal | existing chat/connect flow |

Redaction is enforced **server-side in `getMatchCardData`**: for the two free states the payload carries `{ nameInitial:'D', age }` and `photoUrl:null` (+ silhouette flag) — never the real name or a photo URL. The unlocked state additionally follows the existing messaging gate (connect→chat) for "Send a Message." `connected_unrevealed` (PR #15 rec-accept) is out of the three-state match-card scope but shares the redaction + upgrade-CTA primitives.

---

## 7. Tests

- **sectionMapping:** engine category → section names; band boundaries (59/60, 69/70, 79/80, 89/90, 100).
- **Redaction (API-level, the key assertion):** `getMatchCardData` for a free viewer returns **no `display_name`, no `first_name`, no photo URL, no exact lat/long**; unlocked viewer returns them. Same assertion for the list path after the fix.
- **Schema validation + degradation:** malformed/partial AI JSON is rejected; card falls back to deterministic section data (no throw, no spinner).
- **Cache:** hit on fresh (viewer,match); miss/regeneration when `engine_version`/`source_computed_at` change (recompute invalidation).
- **State selection:** free / nudged (nudge row present) / unlocked chosen correctly; nudged requires a real nudge row.
- **CTA routing:** free/nudged → `/onboarding/membership`; unlocked → existing chat route (unchanged).

---

## 8. Open flags (need a decision; defaults proposed so build isn't blocked)

1. **Overall match badge vocabulary.** Mock unlocked card says "STRONG MATCH"; engine has `tier` (Platinum/Gold/Silver/Bronze); section bands are a third scheme. → *Default:* map the overall Match Score through the same §2 bands for the badge label ("Strong Match" at 80–89). Confirm client's intended overall-badge words.
2. **"Fully Aligned" @ 100.** Mock shows "Fully Aligned" at 100% but "Exceptional Alignment" at 96%. → *Default:* single Exceptional band (90–100) labeled "Exceptional Alignment"; optionally special-case exactly 100 → "Fully Aligned" if client wants it.
3. **Compatible (70–79) label string.** → *Default:* "Compatible" (mock only shows the ≥80 cases).
4. **"This is one of your strongest matches" trigger.** App-owned deterministic headline. → *Default:* shown when the match is in the viewer's top-3 by score (or ≥85). Confirm rule.
5. **"Send a Message" on unlocked card.** Straight to chat vs. still requires a mutual connection first. → *Default:* follow the existing messaging gate (connect→chat); no messaging-route changes.
6. **Rec cards carry-over.** Recommendations share the leaky fetch path (they force silhouette but still receive real name/photo). → *Recommendation:* apply the same server-side redaction fix to the shared path so rec cards also stop leaking (low-risk, no redesign). Confirm in scope.
7. **Provider.** Reusing OpenAI `gpt-4o-mini` (established convention, no new dep). If the client prefers Claude for member-facing copy, that's a flagged provider/key add (`ANTHROPIC_API_KEY`) — not assumed here.

---

## 9. Delivery

- **PR-A — data + AI layer:** mapping + bands, **server-side redaction fix** (security win, lands first), `getMatchCardData`, nudge state, AI interpretation (generate + schema + prompt + cache table + cache/degrade), all §7 tests. No UI.
- **PR-B — UI:** three-state `MatchCard`, expanded breakdown route, list wiring; **screenshots at desktop + mobile for all three states + the breakdown view** in the PR.
- Constraints honored: no engine changes; no fabricated scores; server-side redaction; no new heavy deps; off-hours deploy; existing chat/membership routes untouched but linked.

---

**HARD STOP.** Requesting approval on: the section mapping, the consolidated single-call AI architecture + JSON schema, the cache table + invalidation, the server-side redaction fix as PR-A, and the §8 flag defaults. No UI or migration will be written until you sign off.
