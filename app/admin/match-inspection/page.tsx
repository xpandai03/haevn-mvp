import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdminUser } from '@/lib/admin/allowlist'
import { MatchInspectionView } from '@/components/admin/MatchInspectionView'

export default async function MatchInspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email || !isAdminUser(user.email)) {
    redirect('/account-details')
  }

  const params = await searchParams
  const a = params.a
  const b = params.b

  if (!a || !b) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p className="text-red-600">Missing partnership IDs. Use ?a=...&amp;b=... query params.</p>
      </div>
    )
  }

  return <MatchInspectionView partnershipA={a} partnershipB={b} />
}
