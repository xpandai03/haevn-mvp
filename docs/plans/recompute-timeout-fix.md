# Plan — Match Monday recompute timeout: diagnosis + fix proposal + recovery memo

**Matching output is sacred — parity or disqualification.** This fixes *how fast/reliably*
the recompute runs, never *what it computes*. Scoring (`calculateMatch`, weights, bands,
pair-eligibility) is untouched.

## 1. Diagnosis (measured, read-only)

**Root cause: `computeMatchesForPartnership` re-fetches the ENTIRE base on every call, and
`recomputeAllMatches` calls it 518× sequentially.** The per-partnership fetches are *invariant*
across the run (the whole dataset, unchanged during a batch):

| Repeated fetch (every partnership) | measured |
|---|---:|
| all partnerships (L239) | 649 ms |
| all partnership_members (L272) | 248 ms |
| all user_survey_responses (L360) | 431 ms |
| member profiles (L299) | 282 ms |
| **`auth.admin.listUsers` all ~630 users (L312)** | 241 ms |
| handshakes (L375) | 94 ms |
| **invariant I/O per partnership** | **~1.48 s** |

Plus per partnership: **7 `updateRunStatus` writes + 1 `match_compute` event + 1 `computed_matches`
upsert** (write churn), and 3 small partnership-specific reads.

**Projection (invariant I/O alone, linear ×N):**
| partnerships | invariant I/O | vs 300s budget |
|---|---:|---|
| 140 (Jul 27 got this far) | **207 s** | + writes/compute ≈ 296 s → **killed** ✓ matches evidence |
| 518 (current live) | **766 s** | **2.6× over** |
| 700 | 1036 s | 3.5× over |
| 1000 | 1479 s | 5× over |

**It is I/O-count-bound, not compute-bound** (confirming the suspicion): no AI/external calls in
the path; the cost is ~6 full-dataset reads × 518. The math (scoring ~134k pairs) is cheap in
comparison. **The dominant term is the full-base re-fetch per partnership.** `recomputeAllMatches`
*already* fetches most of this once (lines 8–46, for a name map) — it just doesn't pass it down.

## 2. Fix strategies (STOP — approve one before I implement)

**(a) Hoist the invariant fetches — pass a shared `ctx` into `computeMatchesForPartnership`.**
`recomputeAllMatches` fetches the shared dataset ONCE (already mostly does) and passes it as an
**optional** param; when present, the per-partnership fn skips its internal re-fetches. Removes
517 × 1.48 s = **~765 s**. Output is byte-identical (same data, same scoring). Backward-compatible:
the 3 single-partnership callers (`survey/save`, `import-users`, `computedMatchCards`) pass no ctx
→ unchanged behavior. **Projected ~155–210 s @ 518.** Low risk, small diff. *Marginal 2× headroom
on its own.*

**(a+) (RECOMMENDED) Hoist `ctx` + trim write churn.** On top of (a): derive the 3 partnership-
specific reads from the in-memory ctx (0 reads), and reduce the 7×`updateRunStatus`/partnership +
per-partnership event to periodic progress + one summary (observability preserved, see §3). Same
rows, same upsert semantics — **output identical**. Cuts the residual per-partnership term too.
**Target < 100 s @ 518, comfortable 2× headroom (~1000 partnerships < 200 s)** — to be *proven* in
the verify step, not asserted. Both entry points (cron + `run-full-cycle`) benefit since both call
`recomputeAllMatches`.

**(b) Chunked/resumable execution** (cursor + multi-invocation, release-override + capture exactly
once after the last chunk). Durable at any scale, but real complexity: partial-state visibility,
idempotent chunk writes, exactly-once release, cursor management. **Overkill now** — (a+) fits the
base with headroom for years at current growth. Keep (b) as the documented escalation if the base
ever outgrows a single invocation *after* the I/O fix.

**(c) Raise `maxDuration`.** Vercel note: 300 s is the default across plans; Fluid Compute can go
higher, but **verify the account's cap before relying on it**. Regardless — a budget raise is a
**stopgap that doesn't fix the O(N)-full-scan**; 766 s → 1479 s at 1000 partnerships still loses.
**Rejected as the fix.** (Optional: keep 300 s; the real fix makes it ample.)

**Recommendation: (a+).** Directly kills the diagnosed bottleneck, preserves output exactly, covers
both entry points, small surface. (b) deferred, (c) rejected.

## 3. Observability (non-negotiable, any strategy)
The run ends in **exactly one** terminal event: `match_recompute` **summary** (computed/total,
released, duration) OR a `match_recompute_failed` event with **progress-at-death** (last index +
partnerships done). Wrap the run so the failure event fires even on a thrown/near-timeout exit
(best-effort write before returning). **Completeness surface (no new infra):** extend the admin
`system-status` endpoint to expose *last recompute run: completed? computed/total, released,
finished_at* — so ops/dashboard can see a silent under-run the same hour. "Killed silently" becomes
impossible.

## 4. Output-parity guarantee + tests
- **Parity regression:** on a fixture set, the refactored path (with ctx + batched writes) produces
  **the same `computed_matches` rows** (pair, score, tier, release_at) as the current per-call path.
  This is the disqualifier gate — if rows differ, the strategy is rejected.
- Idempotency: re-triggered run doesn't duplicate/half-apply (upsert on the existing unique key).
- Observability contract: run yields summary XOR failure, never neither (unit test the wrapper).
- Release-override + `match_history` capture: fire **exactly once after the full run**, unchanged.

## 5. Verify (DONE — read-only shadow run against prod, 2026-07-27)
`scratchpad-verify/verify-recompute.ts` (READ-ONLY; writes nothing). Two parts:

**Part A — parity (the disqualifier gate):** for a sample of live partnerships, derive scoring
inputs BOTH ways (ctx-hoisted vs the original per-partnership fetches) and diff every per-candidate
decision (stored / below / constraint-failed / no-survey / no-members / handshake + score + tier).
- Result: **46 partnerships (all 6 couples + 40 spread), 23,828 candidate decisions compared, ZERO
  divergence.** Couples (the member-ordering edge for survey selection) included and identical.
  → **Parity holds. Output is byte-identical.**

**Part B — timing (full base, ctx path, real scoring in-memory, no upsert):**
| stage | measured |
|---|---:|
| context build (ENTIRE full-base I/O, once) | **3.0 s** |
| full-base scoring, 519 partnerships / 263,662 candidate evals | **7.3 s** |
| **TOTAL read + compute** | **10.4 s** |
- vs the **296 s** that was hard-killed at **140/519** on Jul 27. **~28× headroom; 3.5% of the 300 s
  budget.** 2× base (~1038) projects to **~35 s** (scoring is the quadratic term; still ample).
- **Write caveat (honest):** the 10.4 s excludes the per-partnership `computed_matches` upsert (I did
  NOT write to prod). Writes are **unchanged** by this refactor (same rows, same `onConflict`) and
  were a *minority* of the old runtime — the invariant re-reads alone were ~207 s of the 296 s. The
  refactor removes that entire 207 s term plus the 3 small per-partnership reads, the per-partnership
  event, and the ~134k hot log lines. Zero-match partnerships skip the upsert entirely. Net: the full
  run lands far under budget. A precise end-to-end number would need a scratch-table write shadow —
  offered, not required to prove the bottleneck is gone.

**Chunking note (found during verify):** a single `.in()` over ~519 ids exceeds the request URL limit
and silently returns nothing (`fetch failed`). `buildRecomputeContext` chunks all `.in()` calls at 150
— required for correctness now and essential at 2× scale. (The legacy single-partnership path keeps its
existing queries; unchanged, works in prod today.)

## 6. Recovery memo — Jul 27's stranded 402 (PROPOSE ONLY, never executed here)
Jul 27 computed 140/518, then died; 402 fresh rows kept `release_at = 2026-08-03` (release-override
never ran), and **`match_history` has no Jul-27 capture** (capture is wired after the override).
- **(i) Do nothing** — the 402 compute+release automatically on Aug 3 (once the fix is deployed).
  Users waited one week; **no mid-week sends, no re-notify disturbance**. Cleanest. *Recommended if
  the fix lands before Aug 3.*
- **(ii) Manual `run-full-cycle` now** — releases the 402 this week, **but** it also *notifies* (real
  SMS/email to ~200 people mid-week) AND makes them "notified-once", which **shifts next Monday's
  re-notify audience**. Also: `run-full-cycle` uses the *same slow path* — it would **time out too**
  until the fix is deployed. High blast radius. *Not recommended.*
- **(iii) Recompute-only, hold release to Aug 3** (after fix deployed) — refreshes the partial/stale
  compute without any mid-week notify; releases normally Monday. Safe middle ground if you want the
  compute state clean before Monday.
- **match_history:** do **not** back-capture Jul 27 (it was a failed/partial run — capturing 140/518
  would record a false "week"). Let Aug 3 be the first complete capture.

**My pick: (i)** if the fix deploys before Aug 3 (it will) — the 402 simply release Monday, zero
side effects. **Raunek/client decide.** Not executed this session.

## Guardrails
Scoring/bands/eligibility untouched (parity-gated). computed_matches shape unchanged. Release +
notify + re-notify semantics unchanged. Both entry points covered. New `system_events` types are
additive. No PII. Off-hours deploy; ready state confirmed before Sun Aug 2.
