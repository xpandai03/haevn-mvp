/**
 * Route-shape guards for magic-link sign-in.
 * Run: npx tsx lib/auth/__tests__/loginLinkRoutes.test.ts
 *
 * Source-level on purpose. The failure modes here are structural — a response
 * that differs by outcome leaks accounts; a GET that consumes lets a mail
 * scanner burn the link; a signInWithOtp call would send an unbranded email.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { ok, eq, report } from '../../metrics/__tests__/_assert'

const root = join(__dirname, '../../..')
const read = (p: string) => readFileSync(join(root, p), 'utf8')
/** Guards must assert about CODE, not prose — these files explain the traps they
 *  avoid, so the words appear in comments legitimately. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const send = code('app/api/auth/login-link/route.ts')
const landing = code('app/login-link/[token]/route.ts')
const consume = code('app/api/auth/login-link/consume/route.ts')
const page = code('app/auth/login/page.tsx')

function main() {
  // ── the send route cannot leak whether an account exists ──
  eq((send.match(/NextResponse\.json\(/g) ?? []).length, 1, 'send route has exactly ONE response — no branch can differ')
  ok(/ok: true/.test(send), 'that one response is an unconditional ok')
  ok(!/status:\s*4\d\d/.test(send), 'send route never returns a 4xx that would single out an address')
  ok(!/console\.(log|warn|error)\([^)]*email/i.test(send), 'no email address is ever logged')

  // ── it must not create accounts, and must not use Supabase SMTP ──
  ok(!/signInWithOtp/.test(send), 'send route does not use signInWithOtp (that would send Supabase’s unbranded email)')
  ok(!/generateLink/.test(send), 'send route never calls generateLink — it CREATES users on unknown emails')
  ok(/findUserByEmail/.test(send), 'the account is resolved first')
  ok(/scope: 'critical'/.test(send), 'the send is critical scope, so a suppressed member can still sign in')

  // ── the landing page is inert ──
  ok(/export async function GET/.test(landing), 'landing page is a GET')
  ok(!/export async function POST/.test(landing), 'landing page has no POST')
  ok(!/\.update\(/.test(landing), 'landing GET performs no UPDATE — a mail scanner cannot consume the link')
  ok(!/generateLink/.test(landing), 'landing GET never creates a sign-in link')
  ok(/no-store/.test(landing), 'landing page sends Cache-Control: no-store')
  ok(/noindex/.test(landing), 'landing page sends X-Robots-Tag: noindex')

  // ── consumption is POST-only and single-statement ──
  ok(/export async function POST/.test(consume), 'consume is a POST')
  ok(!/export async function GET/.test(consume), 'consume exposes NO GET')
  ok(/\.is\('consumed_at', null\)/.test(consume), 'claims only where consumed_at IS NULL')
  ok(/\.gt\('expires_at'/.test(consume), 'claims only where the handoff is still live')
  eq((consume.match(/\.update\(\{ consumed_at: nowIso/g) ?? []).length, 1, 'exactly one statement can consume a link')
  ok(/303/.test(consume), 'answers with a 303 so the browser follows immediately')
  ok(/auth\/confirm/.test(consume), 'hands off to the existing /auth/confirm handler')
  ok(!/console\.(log|warn|error)\([^)]*hashedToken/.test(consume), 'the magic link is never logged')
  ok(/userId\.slice\(0, 8\)/.test(consume), 'logs identify the account by id prefix only')

  // ── the login page: magic link is the default, password is the fallback ──
  ok(/Send me a sign-in link/.test(page), 'primary button asks for a sign-in link')
  ok(/Sign in with password instead/.test(page), 'password is offered as a secondary path')
  ok(/showPassword \? handleSubmit : handleMagicLink/.test(page), 'the form submits the magic link by default')
  ok(!/signInWithOtp/.test(page), 'the page no longer calls signInWithOtp from the browser')
  ok(/\/api\/auth\/login-link/.test(page), 'it posts to our own send route')
  ok(/Check your email/.test(page), 'the sent state exists')
  ok(/expires in 15 minutes/.test(page), 'the sent state states the TTL')
  ok(/Resend in \$\{resendIn\}s/.test(page), 'resend is gated behind a countdown')
  ok(/That link expired or was already used/.test(page), 'the otp_verify branch has member-friendly copy')
  ok(/if \(!res\.ok\)/.test(page), 'a failed send is reported, never dressed up as "check your email"')

  report('login-link-routes')
}
main()
