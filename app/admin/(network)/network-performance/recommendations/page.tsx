import { Suspense } from 'react'
import { WeeklyPairsClient } from '@/components/admin/network/WeeklyPairsClient'

// Live admin data — never statically cached. Gate + shell come from the
// (network) route-group layout, same as Founding Members.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Recommendations Generated — HAEVN Admin',
}

export default function WeeklyRecommendationsPage() {
  // Suspense: the client reads ?week/&scope via useSearchParams.
  return (
    <Suspense fallback={null}>
      <WeeklyPairsClient band="rec" />
    </Suspense>
  )
}
