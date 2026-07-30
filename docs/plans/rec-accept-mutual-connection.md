# Plan — Recommendation accept-state & mutual connection flow

**Status:** PLAN ONLY — mandatory STOP for approval before any implementation. Read-only recon done; nothing built.
**Date:** 2026-07-27.

## TL;DR — the build is mostly *wiring two things that already exist*

The spec's premise ("no one-way accept state exists anywhere; signals table absent — verified") is **incorrect**. Two accept systems already exist and are the exact building blocks:

- **`ready_to_meet_signals`** (migration 039) = a symmetric, independent-proceed signal, **canonical-pair-keyed** (`partnership_smaller < partnership_larger`), idempotent (unique per signaller), **recompute-proof** (keys on the pair, not a `computed_matches` row). It has a working `deriveState → none | viewer_ready | mutual`, a live API route (`/api/matches/ready-to-meet`), a wired UI button (`ReadyToMeetButton`), and admin surfacing. **This is the specced `pair_responses` table, already built** — minus a decline value, a band, the counterpart notification, and connection creation.
- **`handshakes`** (001 + 016) = the mutual-connection record that *everything downstream reads* (messaging, `getConnections`, reveal, admin). Created today via an **asymmetric** request→accept flow (`sendHandshakeRequest`/`respondToHandshake`).

**They are not connected.** A mutual `ready_to_meet` does **not** create a handshake, fires **no** notification, and has **no** decline. The rec page's "Connect" button uses the *old* asymmetric `sendHandshakeRequest` (creates a one-way `pending` handshake), which is **not** the spec's model.

**Recommended build:** treat `ready_to_meet_signals` as the proceed store (extend it), `hidden_matches` as the decline store (reuse), and add the three missing transitions — **(1)** notify the counterpart exactly once on first proceed, **(2)** create the `handshakes` `matched` row exactly once on mutual proceed, **(3)** expose proceed/decline on the recommendation surface (incl. free members). This avoids a second parallel signals table (the spec explicitly warns against proliferation) and reuses tested, wired machinery. Trade-offs vs. building the literal `pair_responses` table are in §4 as **Client Question #1**.

> **⚠️ LOUD FLAG — identity leakage already exists on recommendations (spec violation, out of scope to fix here).** The current rec card reveals identity by **payment tier, not by mutual accept** — the opposite of the blind-until-mutual spec. See §2. This is the separate blind-rendering workstream's job, but it **materially weakens** the accept-flow's "reveal on mutual connection" for paid viewers, who already see the name. Flagged as a dependency, not fixed here.

---

## 1. Member-surface recon

| Surface | File | What it shows / does today |
|---|---|---|
| Recommendations page | `app/dashboard/recommendations/page.tsx` | Grid of `ProfileCard`s from `getRecommendationCards()`. Actions: **"Connect"** → `sendHandshakeRequest(id)` (old one-way handshake), **"Pass"** → `hideMatch(id)` (hidden_matches). Both passed **only when `!isViewerFree`** — free members get no actions, just "Upgrade to Connect". |
| Matches page | `app/dashboard/matches/page.tsx` | `ProfileCard`s with the **`ReadyToMeetButton`** (the symmetric proceed) already wired — but on *matches*, not recs, and mutual there creates **no** connection. |
| Rec/match card | `components/dashboard/ProfileCard.tsx` | `variant="match"`. Name via `redactName(given)` **only when `isLocked`**; demographics line shown to everyone; photo → silhouette when locked/no-photo. |
| Data layer | `lib/actions/computedMatchCards.ts` | `getRecommendationCards()` (77–79 band) & `getComputedMatchCards()` (≥80). Returns full identity (display_name, first_name, city, age, gender, sexuality, structure); `normalizedTier = tier !== 'free' ? 'plus' : 'free'`. |
| Decline / pass | `lib/actions/hiddenMatches.ts`, `supabase/migrations/041` | `hidden_matches(partnership_id, match_partnership_id, hidden_at, expires_at=+30d, unique(pair))`. **One-directional**, 30-day, idempotent. |
| Proceed signal | `app/api/matches/ready-to-meet/route.ts`, `supabase/migrations/039`, `components/dashboard/ReadyToMeetButton.tsx`, `lib/types/readyToMeet.ts`, `lib/utils/partnershipPair.ts` | Symmetric proceed, canonical pair, `deriveState`, validates a `computed_matches` row exists for the pair (current set only, **not** history). |
| Mutual connection | `lib/actions/handshakes.ts`, migrations 001+016 | `handshakes(a_partnership, b_partnership, a_consent, b_consent, match_score, state('pending'|'viewed'|'matched'|'dismissed'), triggered_at, matched_at)`. 001 also has `UNIQUE(a,b)` + `CHECK(a<b)`. `state='matched' && a_consent && b_consent` = the connection everything reads. |
| Notify stack | `lib/services/notifications.ts` | `sendNotification({ type:'match'|'message', phone, email, senderName, partnershipId, signInUrl })` — SMS-first + email parallel, logs to `system_events` (`notification_sent`). `buildSignInUrl(email)` → magic `token_hash` deep-link. |
| Admin status | `app/api/admin/matches/route.ts`, `lib/admin/matchRows.ts` | **Already** joins handshakes + hidden_matches + ready_to_meet_signals + conversations and derives `Connection = connected | conversation | ready_to_meet | passed | null`. Does **not** yet distinguish one-side vs mutual RTM, nor surface "declined". |

**Decision-rule outcome:** a usable recommendation card surface **exists** (rec page + `ProfileCard`). We do **not** need to stop-and-build a rec view. We proceed — but see §2.

---

## 2. Identity-leakage audit (spec violation — flag, don't fix)

The spec: recommendations are **blind**; identity (names/photos) reveals **only after mutual accept**. Reality:

- **Name:** `ProfileCard` shows the real given name unless `isLocked`; `isLocked = isViewerFree`. → **A paid viewer sees the counterpart's real first name on a blind rec, pre-accept.**
- **Detail page:** paid viewers can click a rec → `/dashboard/matches/[id]` (full profile). → deeper pre-accept reveal.
- **Demographics** (city, gender, sexuality, structure) shown to **everyone**, locked or not.
- **Server-side:** `getRecommendationCards()` sends full identity in the payload regardless of tier — masking is client-side only.
- **Photos:** recs force `photo: undefined` → silhouette. ✅ (the one thing that is blind).

**Conclusion:** reveal is gated on **tier**, not **mutual accept** — structurally opposite to the spec. This belongs to the **blind-rendering redesign workstream (OUT of scope here)**, but it must be fixed there for this accept-flow to mean anything for paid members. **This plan adds no new leakage** and will (a) render the proceed/decline actions without exposing identity in the notification or the connected-unrevealed state, and (b) note the redesign as a hard dependency. **I will not modify the card's current reveal behavior in this PR.**

---

## 3. The core gap (what's missing between the two systems)

```
proceed  →  ready_to_meet_signals      (exists; symmetric; pair-keyed; idempotent)
decline  →  hidden_matches             (exists; one-directional; 30-day)
connection → handshakes state=matched  (exists; read by messaging/reveal/admin)

MISSING LINKS:
  none → one_side  : ✗ no counterpart notification
  mutual           : ✗ no handshakes row created  (mutual RTM ≠ connection today)
  rec surface      : ✗ uses old sendHandshakeRequest, not the proceed signal
  band             : ✗ RTM doesn't record rec vs match
  free members     : ✗ no proceed/decline action rendered
```

---

## 4. Schema decision & data contract

### Recommendation: extend `ready_to_meet_signals` (don't create `pair_responses`)

Add one nullable column; keep decline in `hidden_matches`. **Migration (additive, reversible):**

```sql
-- Band at the moment of the proceed signal, for the client's rec-vs-match
-- accept vocabulary. Nullable so existing rows are unaffected.
ALTER TABLE ready_to_meet_signals
  ADD COLUMN IF NOT EXISTS band_at_signal TEXT
    CHECK (band_at_signal IN ('rec','match'));
```

Everything else the spec asked of `pair_responses` is already present in `ready_to_meet_signals`: canonical pair (`partnership_smaller/larger` + order CHECK), one standing response per side (`UNIQUE(smaller,larger,signaller)`), append-only spirit, service-role RLS, works for matches too (already used there). **`response`** is represented across two tables: a signal row = proceed; a live `hidden_matches` row = decline (see §5). **Finality:** no update path is added — a signal is final (Client Question #3).

**Handshake write contract (on mutual):** insert `handshakes` **canonically ordered** to satisfy 001's `CHECK(a_partnership < b_partnership)` + `UNIQUE(a,b)`: `{ a_partnership: smaller, b_partnership: larger, a_consent: true, b_consent: true, state: 'matched', match_score: <pair score from computed_matches∪match_history>, triggered_at: now, matched_at: now }`. Idempotent: pre-check existing handshake for the pair (any direction); if present, no-op. *(Implementation will confirm 016 didn't drop the `a<b` CHECK; if it did, ordering is still safe.)*

### Alternative (Client Question #1): build the literal `pair_responses` table
One table, `response ('proceed'|'decline')` + `band_at_response`, `unique(partnership_id, pair_key)`. Pros: single source of truth, matches the client's written spec + "Accepted" vocabulary. Cons: **duplicates** `ready_to_meet_signals` (must migrate/deprecate it + its wired button/route/admin), more code, more risk. **My recommendation is the reuse path**; flagged for the client because it diverges from the literal spec.

---

## 5. State machine (pure module + diagram)

State is **derived** per pair from three sources (proceed signals, live hides, handshake). Pure function `derivePairState(pair, {signals, hide, handshake})`.

```
                     ┌─────────── decline (either side, via hidden_matches) ──────────┐
                     ▼                                                                 │
   NONE ──proceed(A)──▶ ONE_SIDE_PROCEEDED ──proceed(B)──▶ MUTUAL_CONNECTION           │
    │                     │  side-effect on ENTER:            side-effect on ENTER:    │
    │                     │  • notify counterpart ×1          • create handshake ×1    │
    │                     │    ("willing to meet", blind)     • (reveal gated, §6)     │
    │                     ▼                                                            │
    └──────────────────▶ DECLINED (terminal for 30d; the decliner's hidden_matches row)◀┘

Guards:
  • proceed after your own decline (live hide) → rejected  ("you passed on this")
  • proceed/any after MUTUAL → rejected/no-op (already connected)
  • proceed on expired pair (computed_matches.expires_at past AND not in match_history) → rejected (Client Q#4)
  • double proceed (retry) → idempotent: one signal row, at most one notification, no error
```

- **Terminal-declined semantics:** decline = write/refresh `hidden_matches` (the decliner ↦ counterpart, 30-day). It is terminal **for 30 days** (then the pair can resurface) — *not* permanently, because `hidden_matches` expires. Stated explicitly as a nuance (Client Question #5: should a decline inside an accept context be permanent vs 30-day?). A live hide on **either** side blocks mutual-connection creation (the state machine checks both sides' hides before creating the handshake).
- **Decline vs hidden_matches:** decline **writes** `hidden_matches` (reuse; no new column/table). It does not "supersede" — a proceed signal and a hide are queried together; a live hide wins for connection-creation purposes.
- **Sender privacy (spec-critical):** the state machine exposes **no** "declined" signal to the *other* side. If A proceeds and B declines, A's view stays **neutral/"waiting"** forever — A never learns B declined, and there are **no view receipts**. Modeled by: A's derived state = `one_side_proceeded` (A sees "waiting"), and the *counterpart's* decline is only ever visible to the counterpart (their own `hidden_matches`). The API's GET for A never returns B's decline.

---

## 6. Reveal gating (tier-tolerant, one function)

- Add **one** gate: `canAccessConnection(partnership): boolean` = `membership_tier !== 'free'` (tolerant of `pro`/`plus`/`select` — see the parallel payments diagnosis; when payments are fixed, only this function changes). Also honors read-time expiry (reuse `isMembershipExpired`).
- **`MUTUAL_CONNECTION` presentation splits by gate:**
  - **Revealed** (`canAccessConnection` true for the viewer) → names/photos/messaging (existing `handshakes` matched → messaging path).
  - **`connected_unrevealed`** (viewer is free) → "You're connected — activate HAEVN+ to see who and start messaging." **No identity rendered.** Minimal state only; the polished CTA is the nudge workstream's job.
  - Gating is **per viewer**: a paid A + free B → A sees B revealed, B sees `connected_unrevealed`, until B upgrades.

---

## 7. API routes (member-authed, idempotent)

Extend the **existing** `/api/matches/ready-to-meet` route rather than adding parallel endpoints:
- **`POST` proceed** (existing, extended): accept `{ otherPartnershipId, band? }`; validate caller is a member of one side (via `selectBestPartnership`), pair exists in **current set OR `match_history`** (today it checks current `computed_matches` only — widen), not expired, caller has no live self-decline. On first-ever signal for the pair → fire counterpart notification (§8). On second side → create handshake (§4). Idempotent on retry (unique constraint + pre-checks). Returns derived state.
- **`POST` decline** (new, small): `{ otherPartnershipId }` → `hideMatch`-equivalent write, member-authed. (Rec page already calls `hideMatch`; formalize as the decline transition.)
- **`GET` states** (existing, extended): batch — return `derivePairState` for the member's rec list so the page renders correct buttons; **never** returns the counterpart's decline.
- Member-authed only (`createClient().auth.getUser()`), **never** admin routes serving member actions. 403 if the caller is a member of neither side.

---

## 8. Counterpart notification (exactly-once, blind)

- Fires **only** on the `none → one_side_proceeded` transition (first signal for the pair). Implementation: fire only when the proceed insert created the pair's **first** signal row (no prior signals existed) → exactly one "willing to meet" notification per pair, ever.
- **Blind:** copy = *"Someone you were recommended is open to connecting on HAEVN. Open the app to take a look."* — **no name, no photo, no score.** CTA = `buildSignInUrl(counterpartEmail)` deep-linking into their rec view.
- **Channel:** SMS-first + email-fallback via `sendNotification`. Add a new `type: 'connection_interest'` (or similar) to `NotificationOptions` with its own SMS/email templates (the existing `'match'` copy is wrong). Logs via the existing `logNotificationEvent → system_events` (no new log table).
- Not fired on mutual/self/expired. If the counterpart has no phone/email, log the skip (still counts as "fired once" so it never double-sends later).

---

## 9. Admin surface (additive)

`app/api/admin/matches/route.ts` + `lib/admin/matchRows.ts` already derive `ready_to_meet`/`connected`/`passed`. Enhance additively:
- Split `ready_to_meet` into **`one_side_accepted`** (1 signal) vs **`mutual`** (2 signals) using the per-pair signaller count already loaded.
- Surface **`declined`** where a live `hidden_matches` row exists for the pair (data already fetched).
- Update the counts strip + the status column labels in `components/admin/matches/MatchesClient.tsx`. Response shape extended **additively** (no breaking changes).

---

## 10. Tests

- **State machine (pure, exhaustive):** every transition; double-proceed idempotency (one row, ≤1 notification); proceed-after-own-decline rejected; any-action-after-mutual rejected/no-op; expired-pair rejected; both-sides-hide blocks mutual.
- **Pair-key canonicalization:** `(A,B) == (B,A)` (reuse/extend `canonicalPartnershipPair` tests).
- **Notification exactly-once:** first proceed fires once; second proceed (mutual) fires zero counterpart-interest notifications; retry fires zero.
- **Handshake exactly-once:** mutual creates one `matched` row; re-trigger/idempotent no-op; canonical ordering respected.
- **Gate:** `canAccessConnection` both tiers (free → `connected_unrevealed`; paid → revealed); expiry path.
- **API authz:** member of neither side → 403; expired pair → clear rejected state; decline never leaks to the other side's GET.
- **Sender privacy:** A-proceeds-then-B-declines → A's GET state stays `one_side_proceeded` (never "declined").

---

## 11. Client questions (recommended defaults implemented unless told otherwise)

1. **Reuse `ready_to_meet_signals` (recommended) vs build `pair_responses`?** Default: **reuse** (less code/risk, no table proliferation). Note: reuse also **conflates "proceed on a blind rec" with "ready to meet IRL on a match"** into one signal — confirm that's intended (the spec says "design it to work for matches too," implying yes).
2. **Blind-rec redesign is a hard dependency** — paid viewers currently see names pre-accept (§2). Confirm the redesign workstream will make recs server-side blind; until then the accept instrumentation ships but "reveal on mutual" is cosmetically moot for paid viewers. OK to ship instrumentation now?
3. **Response finality:** v1 makes a proceed **final** (no un-proceed). Confirm, or do we allow changing your mind?
4. **Expired pair + accept:** default = **reject** proceed/decline on an expired pair (past `expires_at`, not retained in `match_history`). Should proceeding **extend** expiry / revive the pair? Default: no.
5. **Decline permanence:** decline reuses `hidden_matches` (30-day, then resurfaces). In an accept context, should a decline be **permanent** instead? Default: keep 30-day.
6. **Match-band accepts:** schema supports `band='match'`, but this PR wires **UI only for recommendations**. Confirm matches keep the existing `ReadyToMeetButton` behavior for now (we'll unify creation-of-handshake for both bands, but not re-skin matches here).
7. **"Willing to meet" copy** (§8) — confirm the blind wording, or the client provides final copy.

---

## 12. What I will build on approval (scope)

One PR (migration + logic + tests + minimal UI + admin), off-hours:
1. Migration: `band_at_signal` on `ready_to_meet_signals` (additive).
2. Pure state-machine module `derivePairState` + exhaustive tests.
3. Extend `/api/matches/ready-to-meet`: proceed (history-aware, band, first-signal notification, mutual→handshake), decline transition, batch GET; member-authed, idempotent.
4. `canAccessConnection(partnership)` single gate + `connected_unrevealed` state.
5. New blind notification type in the notify stack (+ templates), logged to `system_events`.
6. Rec surface wiring: replace the old `sendHandshakeRequest` "Connect" with **Proceed**, keep **Pass**=decline, **render both for free members too** (gate is on reveal, not on proceeding).
7. Admin: split one-side vs mutual, surface declined, counts strip.
8. **No** change to the rec card's identity reveal (that's the blind-redesign workstream — flagged §2).

**Not building:** `pair_responses` (unless Client Q#1 says so), nudge CTA polish, payment/tier fixes, expiration behaviors, blind-render redesign, "why it fell short of 80" copy.

---

### STOP — approval required before implementation.
The state machine is load-bearing for the whole recommendations catalog and this is member-facing. I need decisions on **Client Questions #1 (reuse vs new table)** and **#2 (ship instrumentation before the blind redesign?)** at minimum before writing code; defaults are implemented for the rest unless you say otherwise.
