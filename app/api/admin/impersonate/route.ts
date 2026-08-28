import { NextRequest, NextResponse } from 'next/server'
import { requireAdminRoute } from '@/lib/admin/requireAdmin'
import { createAdminClient } from '@/lib/supabase/admin'
import { runImpersonation } from '@/lib/admin/impersonation'

export const dynamic = 'force-dynamic'

/**
 * Impersonation side-door — the highest-privilege action. POST { targetUserId, reason }.
 *
 * Order is the guarantee: allowlist gate → (audit row written) → handoff URL
 * returned ONCE. A non-allowlisted caller is refused at the gate and NOTHING is
 * generated.
 *
 * This route no longer produces a sign-in link. It produces an opaque handoff
 * token whose landing page does nothing on GET; the link is created only when a
 * human POSTs from that page (see lib/admin/impersonation.ts for the 2026-08-25
 * incident that forced this). Only the token's SHA-256 is persisted.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdminRoute()
  if (!gate.ok) return gate.response // 401 — nothing resolved, audited, or generated

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
    }
  )

  if (!result.ok) {
    // Log the failure reason ONLY — never a token (there isn't one on this path).
    console.warn('[impersonate] refused/failed:', result.error)
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // The raw handoff token is returned to the caller here and nowhere else.
  return NextResponse.json({ url: result.url, expiresAt: result.expiresAt })
}
