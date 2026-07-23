import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSignInUrl } from '@/lib/services/notifications'
import { runImpersonation } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Impersonation side-door — the highest-privilege action. POST { targetUserId, reason }.
 *
 * Order is the guarantee: allowlist gate → (audit row written) → link generated →
 * returned ONCE. A non-allowlisted caller is refused at the gate and NOTHING is
 * generated. The generated link is never logged or persisted server-side.
 * Reuses the proven generateLink path (buildSignInUrl); no email is sent, TTL is
 * Supabase-default (not extended), same-tab session juggling is out of scope.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response // 403 — nothing resolved, audited, or generated

  const admin = createAdminClient()
  const body = await request.json().catch(() => ({}))
  const targetUserId = String(body?.targetUserId ?? '')
  const reason = String(body?.reason ?? '')

  const result = await runImpersonation(
    { adminEmail: gate.user.email ?? 'unknown', targetUserId, reason },
    {
      resolveEmail: async (uid) => {
        const { data } = await admin.auth.admin.getUserById(uid)
        return data?.user?.email ?? null
      },
      writeAudit: async (row) => {
        const { error } = await admin.from('impersonation_log').insert(row)
        if (error) throw new Error(`audit write failed: ${error.message}`)
      },
      generateLink: (email) => buildSignInUrl(email),
    }
  )

  if (!result.ok) {
    // Log the failure reason ONLY — never a link (there isn't one on this path).
    console.warn('[impersonate] refused/failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // The link is returned to the caller here and nowhere else — not logged, not stored.
  return NextResponse.json({ link: result.link, targetEmail: result.targetEmail })
}
