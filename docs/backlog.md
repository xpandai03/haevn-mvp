# Backlog

Known issues and cleanups that are real but deliberately out of scope for the PR
that found them. Each entry says what it is, where it lives, and why it was left.

---

## `setMonth` DST drift in the Lemon Squeezy webhook

**Where:** [`app/api/lemonsqueezy/webhook/route.ts`](../app/api/lemonsqueezy/webhook/route.ts) — the expiry computation around line 93.

```ts
const expiresAt = new Date()
expiresAt.setMonth(expiresAt.getMonth() + months)
```

`setMonth()` operates in **local** time, so a term that crosses a daylight-saving
boundary lands an hour off. Found while testing the Founding Member promo: a
6-month term from `2026-08-28T12:00:00Z` came out as `2027-02-28T13:00:00Z` under
US Central, because August is CDT and February is CST.

**Impact:** cosmetic for a 6- or 12-month membership — nobody is harmed by an hour
— but it makes the stored value non-deterministic across deploy regions and
awkward to assert in tests.

**Fix:** `setUTCMonth` / `getUTCMonth`, exactly as done in
[`lib/promo/eligibility.ts`](../lib/promo/eligibility.ts) (`computeExpiry`).

**Why not in PR #30:** that PR was explicitly scoped to leave paid checkout
untouched. The promo path already does the arithmetic correctly, so paid and
promo terms differ by at most an hour until this is fixed.

---

## Dead legacy card: `components/MatchCard.tsx`

**Where:** [`components/MatchCard.tsx`](../components/MatchCard.tsx)

**Zero imports anywhere in the repo.** It was superseded by
[`components/matches/MatchCard.tsx`](../components/matches/MatchCard.tsx) (the
three-state card from PR #26) and never removed.

It still carries pre-PR-#28 paywall copy (`Unlock to Connect`), so it shows up in
every grep for reveal/unlock strings and has already caused one false positive in
a copy audit.

**Fix:** delete the file. Confirm zero imports first:

```
grep -rn "from '@/components/MatchCard'" --include="*.tsx" --include="*.ts" . | grep -v node_modules
```

**Why not in PR #28 or #30:** both were scoped to keep their diffs tight, and
deleting a component — even an unused one — deserves its own reviewable change.
