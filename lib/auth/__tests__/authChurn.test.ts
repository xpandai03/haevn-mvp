/**
 * Auth identity churn — the shape guarantees behind the 2026-09-10 loop.
 *
 * A re-emitted SIGNED_IN for the SAME session must not install a new user
 * object, and consumers must key off the id rather than the object. Both are
 * asserted structurally because the failure is a dependency-identity bug that
 * no pure unit test can observe.
 *
 * Run: npx tsx lib/auth/__tests__/authChurn.test.ts
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const ctx = code('lib/auth/context.tsx')
const notif = code('hooks/useNotifications.ts')

function main() {
  // ══ (a) AuthProvider guards the user identity ════════════════════════════
  ok(/currentUserIdRef/.test(ctx), 'AuthProvider tracks the current user id')
  ok(/const nextUserId = session\?\.user\?\.id \?\? null/.test(ctx), 'it reads the id off the session')
  ok(/if \(currentUserIdRef\.current !== nextUserId\)/.test(ctx),
    'setUser runs ONLY when the id actually changed — a same-session SIGNED_IN is a no-op')

  // The guard must wrap setUser, not setSession: token rotation still matters
  // to anything reading the access token.
  const handler = ctx.slice(ctx.indexOf('onAuthStateChange'), ctx.indexOf('return () => {'))
  const guardIdx = handler.indexOf('if (currentUserIdRef.current !== nextUserId)')
  const setUserIdx = handler.indexOf('setUser(session?.user ?? null)', guardIdx)
  ok(guardIdx > -1 && setUserIdx > guardIdx, 'setUser sits inside the identity guard')
  ok(/setSession\(session\)/.test(handler), 'setSession is NOT gated — the session still refreshes')
  const setSessionIdx = handler.indexOf('setSession(session)')
  ok(setSessionIdx > -1 && setSessionIdx < guardIdx, 'the session is updated before the identity guard')

  // Real state changes must still propagate — the regression risk of (a).
  ok(/event === 'SIGNED_OUT'/.test(handler), 'SIGNED_OUT is still handled')
  const outBlock = handler.slice(handler.indexOf("event === 'SIGNED_OUT'"))
  ok(/currentUserIdRef\.current = null/.test(outBlock), 'sign-out clears the id marker')
  ok(/setUser\(null\)/.test(outBlock), 'sign-out clears the user')
  ok(/router\.push\('\/'\)/.test(outBlock), 'sign-out still navigates')
  ok(/currentUserIdRef\.current = session\?\.user\?\.id \?\? null/.test(ctx),
    'the initial session seeds the marker, so the first re-emission is correctly a no-op')

  // ══ (b) consumers key off the id ═════════════════════════════════════════
  ok(/\}, \[user\?\.id, supabase, toast\]\)/.test(notif),
    'useNotifications depends on user?.id, not the user object')
  ok(!/\}, \[user, supabase, toast\]\)/.test(notif), 'the object-identity dependency is gone')

  // ══ 404 boundary ═════════════════════════════════════════════════════════
  ok(existsSync(join(root, 'app/not-found.tsx')), 'the app has a not-found boundary')
  const nf = read('app/not-found.tsx')
  ok(!/'use client'/.test(nf), 'not-found is a server component')
  ok(!/useEffect|useState|createClient|useAuth/.test(nf),
    'not-found runs no hooks, no auth and no data fetching — it must be inert')

  report('auth-churn')
}
main()
