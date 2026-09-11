/**
 * Auth-event churn — redundant Supabase reads, and the regressions that guarding
 * the user identity could plausibly introduce.
 *
 * Supabase re-emits SIGNED_IN on every page load for an existing session. When
 * the provider replaced the user OBJECT on each of those, every consumer with
 * `user` in a dependency array re-ran — costing 6 partnership_members queries
 * per signed-in page load instead of 2.
 *
 * The shape is asserted structurally because the defect is a dependency-identity
 * bug: no pure unit test can observe an object being needlessly replaced.
 *
 * THE REGRESSION RISK is the point of the second half. Making a same-session
 * re-emission a no-op must NOT make the listener deaf to real state changes, so
 * sign-out, account switch and token refresh are each pinned explicitly.
 *
 * Run: npx tsx lib/auth/__tests__/authChurn.test.ts
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ctx = code('lib/auth/context.tsx')
const notif = code('hooks/useNotifications.ts')
const handler = ctx.slice(ctx.indexOf('onAuthStateChange'), ctx.indexOf('return () => {'))

/**
 * The guard, extracted as the pure decision it encodes, so the branch table is
 * exercised rather than only pattern-matched.
 */
function shouldReplaceUser(currentId: string | null, nextId: string | null): boolean {
  return currentId !== nextId
}

function main() {
  // ══ 1. THE GUARD ═════════════════════════════════════════════════════════
  ok(/currentUserIdRef/.test(ctx), 'the provider tracks the current user id')
  ok(/const nextUserId = session\?\.user\?\.id \?\? null/.test(ctx), 'it reads the id off the session')
  ok(/if \(currentUserIdRef\.current !== nextUserId\)/.test(ctx),
    'the user object is replaced ONLY when the id changed')

  const guardIdx = handler.indexOf('if (currentUserIdRef.current !== nextUserId)')
  const setUserIdx = handler.indexOf('setUser(session?.user ?? null)', guardIdx)
  ok(guardIdx > -1 && setUserIdx > guardIdx, 'setUser sits inside the guard')

  // setSession must NOT be gated — token rotation matters to callers reading
  // the access token, and gating it would be a genuine functional regression.
  const setSessionIdx = handler.indexOf('setSession(session)')
  ok(setSessionIdx > -1, 'the session is still updated on every event')
  ok(setSessionIdx < guardIdx, 'the session update happens BEFORE (and outside) the identity guard')

  // ══ 2. THE DECISION TABLE ════════════════════════════════════════════════
  const U1 = 'user-1', U2 = 'user-2'
  ok(!shouldReplaceUser(U1, U1), 'same session re-emission -> no replacement (the whole point)')
  ok(shouldReplaceUser(null, U1), 'anonymous -> signed in -> replace')
  ok(shouldReplaceUser(U1, null), 'signed in -> signed out -> replace')
  ok(shouldReplaceUser(U1, U2), 'ACCOUNT SWITCH -> replace')
  ok(!shouldReplaceUser(null, null), 'still anonymous -> no replacement')

  // ══ 3. REGRESSIONS — real state changes must still propagate ═════════════
  // SIGN-OUT
  ok(/event === 'SIGNED_OUT'/.test(handler), 'SIGNED_OUT is still handled')
  const outBlock = handler.slice(handler.indexOf("event === 'SIGNED_OUT'"))
  ok(/setSession\(null\)/.test(outBlock), 'sign-out clears the session')
  ok(/setUser\(null\)/.test(outBlock), 'sign-out clears the user UNCONDITIONALLY — not behind the guard')
  ok(/currentUserIdRef\.current = null/.test(outBlock), 'sign-out resets the id marker')
  const clearIdx = outBlock.indexOf('currentUserIdRef.current = null')
  const setNullIdx = outBlock.indexOf('setUser(null)')
  ok(clearIdx > -1 && setNullIdx > clearIdx,
    'the marker is cleared BEFORE the user, so a later re-sign-in is seen as a change')
  ok(/router\.push\('\/'\)/.test(outBlock), 'sign-out still navigates away')

  // RE-SIGN-IN after sign-out: marker is null, so any id is a change.
  ok(shouldReplaceUser(null, U1), 'a fresh sign-in after sign-out propagates')

  // TOKEN REFRESH must be a no-op for the user object but must not be swallowed.
  ok(/event === 'TOKEN_REFRESHED'/.test(handler), 'TOKEN_REFRESHED is still handled')
  ok(!shouldReplaceUser(U1, U1), 'a token refresh for the same user replaces no object')
  const refreshIdx = handler.indexOf("event === 'TOKEN_REFRESHED'")
  ok(refreshIdx > setSessionIdx,
    'setSession runs before the TOKEN_REFRESHED branch — the rotated token still reaches state')

  // INITIAL_SESSION and USER_UPDATED branches survive.
  for (const ev of ['INITIAL_SESSION', 'USER_UPDATED']) {
    ok(new RegExp(`event === '${ev}'`).test(handler), `${ev} is still handled`)
  }

  // The initial load seeds the marker, so the SIGNED_IN Supabase emits straight
  // after it is correctly recognised as "no change" rather than a fresh login.
  ok(/currentUserIdRef\.current = session\?\.user\?\.id \?\? null/.test(ctx),
    'the initial session seeds the id marker')

  // ══ 4. CONSUMER KEYS OFF THE ID ══════════════════════════════════════════
  ok(/\}, \[user\?\.id, supabase, toast\]\)/.test(notif),
    'useNotifications depends on user?.id, not the user object')
  ok(!/\}, \[user, supabase, toast\]\)/.test(notif), 'the object-identity dependency is gone')
  ok(/partnership_members/.test(notif), 'that effect is indeed the one issuing the reads')

  report('auth-event-churn')
}
main()
