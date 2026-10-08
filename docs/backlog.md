# Backlog

Small, dated, non-urgent work that would otherwise get lost. Newest first.
Anything with a hard external deadline carries it in the heading.

---

## Photo data reconciliation + upload path audit — before any photo-nudge campaign

**Raised:** 2026-10-08, from the photo read-path fix (PR #61). No action taken yet.
Most urgent before a photo-nudge or "add a photo" campaign, because new uploads land
on the path questioned below.

PR #61 made every surface read `partnership_photos.photo_url` as-is. Before it, every
member photo showed a silhouette. That made three pre-existing data/write-path
problems visible:

1. **Files with no rows.** A few folders in the `public-photos` bucket hold image files
   that no `partnership_photos` row points to. Those photos are invisible to every
   surface. Re-derive the list by comparing the bucket's top-level folders with the
   distinct `partnership_id`s in `partnership_photos`.
2. **Files in the old bucket.** A few folders sit in `partnership-photos`, and no row
   references them; every stored `photo_url` points at `public-photos`. The likely
   writer is `lib/actions/uploadProfilePhoto.ts`, which still uploads to
   `partnership-photos`. Open questions:
   - Does any live UI still call it?
   - Does the row it writes carry a working `photo_url`?
   - Should it move to `public-photos`, like `app/api/photos/upload` and survey ingest?
3. **Rows pointing at deleted files.** At least one member had a primary row whose file
   was gone from storage (400). It was hot-fixed 2026-10-08 by re-pointing the primary
   to the newest surviving file. The dead row is still there as a non-primary photo, so
   the profile gallery (`lib/actions/profiles.ts` lists every public photo) can show one
   broken thumbnail. Sweep for this: every row whose `photo_url` doesn't return 200.

**When picking this up:**
- Decide per case: backfill rows for orphan files (only if the member intended them),
  delete dead rows, and move or retire the old-bucket writer.
- Keep `lib/photos/__tests__/photoReadPath.test.ts` green. It pins `getPublicUrl` to
  the upload paths, so an upload-path change will need its allowlist updated
  deliberately.

---

## ⚠️ Next 15.5.12 App Router loop on unmatched routes — MITIGATED, root cause open

**Raised:** 2026-09-10. **Mitigated by PR #40.** Revisit on the next Next upgrade.

### What happens

A **signed-in** visitor on a URL with no matching route puts the App Router into
an unbounded reload cycle. Anonymous visitors are unaffected. Measured on
production, one visitor, 15s window: **2,685 requests, 114 frame navigations,
114 `?_rsc=` fetches, ~345 Supabase reads.**

### The trigger sequence — captured, not inferred

One cycle, repeating every ~20ms (CDP timeline, ms since navigate):

```
39ms  FRAME-NAVIGATED (full document load)
46ms  history.replaceState        <- Next router
47ms  AUTH-INIT (auth provider mounts)
48ms  AUTH-EVENT SIGNED_IN
48ms  RSC-FETCH ?_rsc=...          -> 404
50ms  AUTH-EVENT INITIAL_SESSION
51ms  partnership_members queries
54ms  DOCUMENT request -> FRAME-NAVIGATED -> repeat
```

**The router acts first.** `history.replaceState` at 46ms precedes the auth
provider mounting at 47ms. The router re-initialises on an unmatched route,
fetches the RSC payload, gets a 404, and hard-navigates — which remounts
everything and repeats.

### What it is NOT — ruled out with measurements

60 runs across six configurations (10 each, all on build-identity-verified
servers), loop rate on a signed-in unknown URL:

| Config | Loop rate |
|---|---|
| baseline | 9/10 |
| + AuthProvider identity guard (a) | 10/10 |
| + useNotifications on `user?.id` (b) | 10/10 |
| + (a) + (b) | 10/10 |
| + guard `router.refresh()` on same-session SIGNED_IN (c) | 10/10 |
| + `app/not-found.tsx` boundary | 10/10 |

**None of them changes the rate.** Auth churn looked causal because `SIGNED_IN`
precedes the RSC fetch by 1ms — but config (c) disproved it: with
`router.refresh()` guarded, the RSC-fetch count stayed pinned to the navigation
count. Those fetches are the router's own, not ours. **Auth churn is a passenger,
not the driver.**

Also ruled out: service worker (none exists), `MESSAGING_ENABLED` / recent PRs
(the preview-vs-prod comparison was invalid — preview 302s to SSO and never
reaches the app), and the edge-cached 404 stripping `Set-Cookie` (real routes
also return no `Set-Cookie` and do not loop).

### Measurement note for whoever picks this up

**The loop is non-deterministic and the FIRST run after a cold server start
usually settles.** Single-run A/B is worthless here and produced two retracted
conclusions before this was understood. Use ≥10 runs per configuration and
report the rate. The harness must assert the served `BUILD_ID` matches
`.next/BUILD_ID` before trusting any number — stale `next start` processes
silently serve old builds.

### Current containment

PR #40: middleware returns a bare `text/plain` 404 for unmatched paths as its
first statement, before any auth or Supabase work. An unknown URL never renders
the app shell, so it cannot churn regardless of cause. Verified on production:
both known junk URLs settle at 1–2 requests with **zero** renavigations over 60s
and zero Supabase reads.

### When revisiting

1. Reproduce on a minimal Next app to confirm it is framework behaviour, then
   file upstream if so.
2. Re-test on the upgraded Next version (pairs naturally with the Node 24.x
   item below).
3. **Add `app/not-found.tsx` at that time.** It is correct regardless — the app
   has no not-found boundary today — but it does not fix the loop, and with the
   mitigation live no unmatched URL reaches it, so it is cosmetic until then.
   Held on branch `fix/auth-identity-churn`.

---

## ⏰ Node 24.x engines bump — **hard deadline 2026-10-01**

**Raised:** 2026-09-10, from a Vercel build log during the messaging deploy.

Every production build currently warns:

```
Error: Node.js version 20.x is deprecated. Deployments created on or after
2026-10-01 will fail to build. Please set "engines": { "node": "24.x" } in your
`package.json` file to use Node.js 24.
```

It is printed as `Error:` but is **non-fatal today** — builds still succeed. On
**2026-10-01 it becomes fatal** and every deploy fails, including an emergency
rollback-by-redeploy. That is the real risk: not the warning, but losing the
ability to ship on a day we need to.

**The change:** add to `package.json`

```json
"engines": { "node": "24.x" }
```

**Do not treat it as a one-line PR.** It moves the runtime for every serverless
function, so it wants its own PR with a full `npm run build`, the complete test
suite, and a preview deployment exercised before production — not a flag flip
bolted onto another change. Watch for native-dependency and `crypto`/`stream`
behaviour differences.

**Suggested timing:** mid-to-late September, on a quiet day, well clear of a
Match Monday (crons run Mon 12:00/14:00/16:00 UTC).

---

## Unreferenced exports in the chat module

**Raised:** 2026-09-10, during the messaging pre-flight (PR #36).

Deleting `components/ChatConversation.tsx` and `lib/services/chat.ts sendMessage()`
left four exports with no callers anywhere:

- `getHandshakeMessages`
- `togglePhotoGrant`
- `getUserHandshakes`
- `getUnreadMessageCounts`

Left in place deliberately — removing them was outside that PR's scope. Worth a
tidy-up pass. Note the last two being unused is also the answer to "do we have
unread badges?": **there are none wired up anywhere**, so if unread counts are
ever wanted in the UI, that is a build, not a re-connect.

`subscribeToMessages` and `markMessagesAsRead` are still live — `/chat/[connectionId]`
uses both. Do not remove those.
