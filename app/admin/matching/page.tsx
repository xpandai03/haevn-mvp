/**
 * Matching Control Center - Admin Page
 *
 * Internal-only observability tool for debugging the matching engine.
 * Access is restricted to allowlisted emails via server-side check.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'
import { MatchingDashboard } from '@/components/admin/MatchingDashboard'

export default async function AdminMatchingPage() {
  // Server-side access gate - redirect if not admin
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    redirect('/account-details')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a href="/account-details" className="text-gray-400 hover:text-gray-600 text-sm">
                ← Back
              </a>
              <div className="flex items-center gap-3">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: '#008080' }}
                >
                  H
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">Matching Control Center</h1>
                  <p className="text-xs text-gray-400">
                    {user.email}
                  </p>
                </div>
              </div>
            </div>
            <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider bg-gray-100 text-gray-500 rounded">
              Internal
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <MatchingDashboard userEmail={user.email} />
      </main>
    </div>
  )
}
