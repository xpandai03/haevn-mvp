# Backlog

Small, dated, non-urgent work that would otherwise get lost. Newest first.
Anything with a hard external deadline carries it in the heading.

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
