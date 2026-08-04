/**
 * Match Inspection — pairwise debug view (?a=…&b=…). Gate + shell from the
 * (tools) layout; presentational.
 */
import { requireAdminPage } from '@/lib/admin/requireAdmin'
import { MatchInspectionView } from '@/components/admin/MatchInspectionView'

export default async function MatchInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  await requireAdminPage()
  const { a, b } = await searchParams

  if (!a || !b) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p className="text-red-600">Missing partnership IDs. Use ?a=...&amp;b=... query params.</p>
      </div>
    )
  }
  return <MatchInspectionView partnershipA={a} partnershipB={b} />
}
