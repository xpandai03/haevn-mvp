/**
 * Impersonation invariants. Run: npx tsx lib/admin/__tests__/impersonation.test.ts
 * Audit-FIRST ordering, refuse-without-generating (reason/target), and that the
 * generated link never appears in any log output.
 */
import { runImpersonation, type ImpersonationDeps } from '../impersonation'
import { eq, ok, report } from '../../metrics/__tests__/_assert'

const LINK = 'https://www.haevn.app/auth/confirm?token_hash=SECRETTOKEN&type=magiclink'

function deps(over?: Partial<ImpersonationDeps>) {
  const calls: string[] = []
  const audits: any[] = []
  const d: ImpersonationDeps = {
    resolveEmail: async () => { calls.push('resolveEmail'); return 'target@user.com' },
    writeAudit: async (row) => { calls.push('writeAudit'); audits.push(row) },
    generateLink: async () => { calls.push('generateLink'); return LINK },
    ...over,
  }
  return { d, calls, audits }
}

async function main() {
  // reason REQUIRED — nothing resolved/audited/generated
  {
    const { d, calls } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: '  ' }, d)
    ok(!r.ok && r.status === 400, 'empty reason → 400')
    eq(calls, [], 'empty reason → no resolve/audit/generate at all')
  }

  // happy path — audit BEFORE link, returns link
  {
    const { d, calls, audits } = deps()
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: 'safety review' }, d)
    ok(r.ok, 'valid → ok')
    if (r.ok) eq(r.link, LINK, 'returns the link')
    ok(calls.indexOf('writeAudit') < calls.indexOf('generateLink'), 'AUDIT written BEFORE link generated')
    eq(audits[0], { admin_email: 'a@admin', target_user_id: 'u1', reason: 'safety review' }, 'audit row content')
  }

  // target not found — no audit, no link
  {
    const { d, calls } = deps({ resolveEmail: async () => { return null } })
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'ghost', reason: 'x' }, d)
    ok(!r.ok && r.status === 404, 'unknown target → 404')
    ok(!calls.includes('writeAudit'), 'unknown target → NO audit')
    ok(!calls.includes('generateLink'), 'unknown target → NO link')
  }

  // link generation fails — but audit STILL written (audit-first even on failure)
  {
    const { d, calls } = deps({ generateLink: async () => null })
    const r = await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: 'x' }, d)
    ok(!r.ok && r.status === 500, 'link failure → 500')
    ok(calls.includes('writeAudit'), 'link failure → audit still recorded the attempt')
  }

  // the link NEVER appears in any log output during a run
  {
    const logged: string[] = []
    const orig = { log: console.log, warn: console.warn, error: console.error, info: console.info }
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) {
      ;(console as any)[k] = (...args: any[]) => logged.push(args.map(String).join(' '))
    }
    try {
      const { d } = deps()
      await runImpersonation({ adminEmail: 'a@admin', targetUserId: 'u1', reason: 'x' }, d)
    } finally {
      Object.assign(console, orig)
    }
    ok(!logged.join('\n').includes('SECRETTOKEN'), 'link/token NEVER written to any console output')
  }

  report('impersonation')
}

main().catch((e) => { console.error(e); process.exit(1) })
