import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/services/email'
import { requestLoginLink, LOGIN_LINK_TTL_MINUTES, RATE_LIMIT } from '@/lib/auth/loginLink'
import { loginLinkEmail } from '@/lib/auth/loginLinkEmail'

export const dynamic = 'force-dynamic'

/**
 * "Email me a sign-in link" — POST { email }.
 *
 * ALWAYS RETURNS THE SAME 200. Known email, unknown email, rate-limited, or
 * malformed: identical body, identical timing-insensitive shape. The login page
 * renders "check your email" for all of them. Anything else would leak whether
 * an address has a HAEVN account.
 *
 * No account is ever created here — see lib/auth/loginLink.ts for why that
 * needs care (generateLink creates users; this flow resolves first).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const email = String(body?.email ?? '')
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null

  const admin = createAdminClient()

  const outcome = await requestLoginLink(email, ip, {
    findUserByEmail: async (normalized) => {
      // Case-insensitive by construction: GoTrue stores emails lowercased and
      // `normalized` is already lower/trimmed, so a member who types MiXeD case
      // still resolves. listUsers is paged; the filter is exact on the address.
      const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const hit = data?.users.find((u) => (u.email ?? '').toLowerCase() === normalized)
      return hit?.id ?? null
    },

    countAttempts: async (emailHash, reqIp) => {
      const emailSince = new Date(Date.now() - RATE_LIMIT.perEmail.windowMs).toISOString()
      const ipSince = new Date(Date.now() - RATE_LIMIT.perIp.windowMs).toISOString()
      const [{ count: emailCount }, ipRes] = await Promise.all([
        admin.from('login_links').select('*', { count: 'exact', head: true })
          .eq('email_hash', emailHash).gte('created_at', emailSince),
        reqIp
          ? admin.from('login_links').select('*', { count: 'exact', head: true })
              .eq('request_ip', reqIp).gte('created_at', ipSince)
          : Promise.resolve({ count: 0 } as { count: number | null }),
      ])
      return { email: emailCount ?? 0, ip: (ipRes as { count: number | null }).count ?? 0 }
    },

    record: async (row) => {
      const { error } = await admin.from('login_links').insert(row)
      if (error) throw new Error(`login_links insert failed: ${error.message}`)
    },

    sendLink: async (to, url) => {
      const { subject, html } = loginLinkEmail(url)
      // scope 'critical' — a suppressed member must still be able to sign in.
      // Same rule as match notifications; see lib/services/email.ts.
      await sendEmail(to, subject, html, { scope: 'critical' })
    },
  })

  // Outcome is for the log only — never for the response. No email in the log.
  console.log('[login-link] request outcome:', outcome)

  return NextResponse.json({ ok: true, expiresInMinutes: LOGIN_LINK_TTL_MINUTES })
}
