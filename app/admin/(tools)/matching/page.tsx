/**
 * Matching Control Center (Matching Ops) — internal matching-engine
 * observability. Gate + shell come from the (tools) layout; this page is
 * presentational. Keeps a link to Import Users (as before).
 */
import { requireAdminPage } from '@/lib/admin/requireAdmin'
import { MatchingDashboard } from '@/components/admin/MatchingDashboard'

export default async function AdminMatchingPage() {
  const user = await requireAdminPage()
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <a
          href="/admin/import-users"
          className="text-sm font-medium text-[#E29E0C] hover:text-[#C2850A]"
        >
          Import Users →
        </a>
      </div>
      <MatchingDashboard userEmail={user.email!} />
    </div>
  )
}
