/**
 * Admin: Import Users. Gate + shell from the (tools) layout; presentational.
 */
import { requireAdminPage } from '@/lib/admin/requireAdmin'
import { ImportUsersClient } from '@/components/admin/ImportUsersClient'

export default async function AdminImportUsersPage() {
  await requireAdminPage()
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-semibold text-gray-900">Import Users</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        Upload a JSON file of Emergent survey submissions. Each record becomes a
        HAEVN account with a mapped survey so they feed the matching engine.
        Existing emails are skipped. Matches compute on the next Match Monday
        unless you opt into inline computation.
      </p>
      <ImportUsersClient />
    </div>
  )
}
