/**
 * Route-shape guards for the impersonation flow.
 * Run: npx tsx lib/admin/__tests__/impersonationRoutes.test.ts
 *
 * These are source-level assertions on purpose. The 2026-08-25 failure was not
 * a logic bug — it was a URL that a machine could burn by looking at it. The
 * only durable defence is that the shape can't drift back: no sign-in link may
 * be created at generation time, and nothing may be consumed on a GET.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')

const generate = read('app/api/admin/impersonate/route.ts')
const landing = read('app/impersonate/[token]/route.ts')
const consume = read('app/api/impersonate/consume/route.ts')

function main() {
  // ── the old magic-link-at-generation code path is gone ──────────────────
  ok(!/buildSignInUrl/.test(generate), 'generate route no longer imports buildSignInUrl')
  ok(!/generateLink/.test(generate), 'generate route never creates a sign-in link')
  ok(!/auth\/confirm/.test(generate), 'generate route never builds an /auth/confirm URL')
  ok(!/\blink\b\s*:/.test(generate), 'generate route no longer returns a `link` field')
  ok(/result\.url/.test(generate), 'generate route returns the handoff url')
  ok(/requireAdminRoute/.test(generate) && generate.indexOf('requireAdminRoute') < generate.indexOf('runImpersonation'),
    'allowlist gate still runs before anything else — unauth POST gets 401 with no link')
  ok(/writeAudit/.test(generate), 'audit write is still wired')

  // ── the landing page is inert: it reads, it never writes ────────────────
  ok(/export async function GET/.test(landing), 'landing page is a GET')
  ok(!/export async function POST/.test(landing), 'landing page has no POST — the button posts elsewhere')
  ok(!/\.update\(/.test(landing), 'landing GET performs no UPDATE (cannot consume the token)')
  ok(!/consumed_at:/.test(landing), 'landing GET never assigns consumed_at')
  ok(!/generateLink/.test(landing), 'landing GET never creates a sign-in link')
  ok(/no-store/.test(landing), 'landing page sends Cache-Control: no-store')
  ok(/x-robots-tag/.test(landing) && /noindex/.test(landing), 'landing page sends X-Robots-Tag: noindex')

  // ── consumption is POST-only and single-statement ───────────────────────
  ok(/export async function POST/.test(consume), 'consume route is a POST')
  ok(!/export async function GET/.test(consume), 'consume route exposes NO GET — a scanner cannot reach it')
  ok(/\.is\('consumed_at', null\)/.test(consume), 'consume claims only where consumed_at IS NULL')
  ok(/\.gt\('expires_at'/.test(consume), 'consume claims only where the handoff is still live')
  eq((consume.match(/\.update\(\{ consumed_at: nowIso/g) ?? []).length, 1,
    'exactly one statement can mark a handoff consumed')
  ok(/303/.test(consume), 'consume answers with a 303 so the browser follows immediately')

  // ── the sign-in link never leaks ────────────────────────────────────────
  ok(!/NextResponse\.json\([^)]*hashedToken/.test(consume), 'the magic link never appears in a response body')
  ok(!/console\.(log|warn|error)\([^)]*hashedToken/.test(consume), 'the magic link is never logged')
  ok(!/console\.(log|warn|error)\([^)]*\btoken\b/.test(consume), 'the raw handoff token is never logged')
  ok(/targetUserId\.slice\(0, 8\)/.test(consume), 'logs identify the target by id prefix only — no PII')

  report('impersonation-routes')
}
main()
