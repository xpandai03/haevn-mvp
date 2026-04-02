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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <a
            href="/account-details"
            className="text-sm text-gray-400 hover:text-gray-600 shrink-0"
          >
            ← Back
          </a>
          <img
            src="/haevn-logo-transparent.svg"
            alt="HAEVN"
            className="w-48 sm:w-56"
          />
          <div className="w-12" />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <MatchingDashboard userEmail={user.email} />
      </main>
    </div>
  )
}
