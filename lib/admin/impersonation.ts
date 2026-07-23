/**
 * Impersonation core — pure and injectable so the audit-first ordering and the
 * "refuse without generating anything" rules are unit-tested with spies (no DB,
 * no auth, no real link). The route wires real deps; the allowlist gate lives at
 * the route (a non-allowlisted caller never reaches this function).
 *
 * INVARIANTS enforced here:
 *   - a reason is REQUIRED (no reason → nothing happens),
 *   - the audit row is written BEFORE the sign-in link is generated,
 *   - the link is returned once and NEVER logged here.
 */

export interface ImpersonationDeps {
  /** target user id → email (null if not found). */
  resolveEmail: (userId: string) => Promise<string | null>
  /** append-only audit write. Must complete before the link is generated. */
  writeAudit: (row: { admin_email: string; target_user_id: string; reason: string }) => Promise<void>
  /** generate a passwordless sign-in link (null on failure). */
  generateLink: (email: string) => Promise<string | null>
}

export interface ImpersonationParams {
  adminEmail: string
  targetUserId: string
  reason: string
}

export type ImpersonationResult =
  | { ok: true; link: string; targetEmail: string }
  | { ok: false; error: string; status: number }

export async function runImpersonation(
  p: ImpersonationParams,
  deps: ImpersonationDeps
): Promise<ImpersonationResult> {
  const reason = (p.reason ?? '').trim()
  if (!reason) return { ok: false, error: 'A reason is required for impersonation.', status: 400 }
  if (!p.targetUserId) return { ok: false, error: 'targetUserId is required.', status: 400 }

  const email = await deps.resolveEmail(p.targetUserId)
  if (!email) return { ok: false, error: 'Target user not found.', status: 404 }

  // ── AUDIT FIRST — the row exists before any link does. ──
  await deps.writeAudit({ admin_email: p.adminEmail, target_user_id: p.targetUserId, reason })

  const link = await deps.generateLink(email)
  if (!link) return { ok: false, error: 'Could not generate sign-in link.', status: 500 }

  return { ok: true, link, targetEmail: email }
}
