/**
 * Admin: Import Users
 *
 * Upload a JSON export of Emergent demo survey submissions and create real
 * HAEVN accounts (auth user + partnership + member + mapped survey responses).
 * Access restricted to allowlisted admin emails via server-side check.
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'
import { ImportUsersClient } from '@/components/admin/ImportUsersClient'

export default async function AdminImportUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    redirect('/account-details')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
          <a
            href="/admin/matching"
            className="shrink-0 text-sm text-gray-400 hover:text-gray-600"
          >
            ← Control Center
          </a>
          <img src="/haevn-logo-with-icon.svg" alt="HAEVN" className="h-10 sm:h-12" />
          <div className="w-28" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold text-gray-900">Import Users</h1>
        <p className="mb-6 mt-1 text-sm text-gray-500">
          Upload a JSON file of Emergent survey submissions. Each record becomes a
          HAEVN account with a mapped survey so they feed the matching engine.
          Existing emails are skipped. Matches compute on the next Match Monday
          unless you opt into inline computation.
        </p>
        <ImportUsersClient />
      </main>
    </div>
  )
}
