/**
 * Matching Control Center - Admin Page
 *
 * Internal-only observability tool for debugging the matching engine.
 * Access is restricted to allowlisted emails via server-side check.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'
import { MatchingControlCenter } from '@/components/admin/MatchingControlCenter'

export default async function AdminMatchingPage() {
  // Server-side access gate - redirect if not admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    // Silent redirect - don't hint that admin route exists
    redirect('/account-details')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-purple-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <a
                href="/account-details"
                className="text-purple-200 hover:text-white text-sm"
              >
                ← Back to Account
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-semibold uppercase tracking-wider bg-purple-700 rounded">
                Internal
              </span>
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-2xl font-bold">Matching Control Center</h1>
            <p className="text-purple-200 text-sm mt-1">
              Debug matches, scores, and social state • Logged in as {user.email}
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <MatchingControlCenter userEmail={user.email} />
      </main>
    </div>
  )
}
