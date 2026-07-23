import { MatchesClient } from '@/components/admin/matches/MatchesClient'

// Live admin data — never statically cached.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Matches — HAEVN Admin',
}

export default function MatchesPage() {
  return <MatchesClient />
}
