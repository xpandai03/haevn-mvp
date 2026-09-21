import { FoundingMembersClient } from '@/components/admin/founding/FoundingMembersClient'

// Live admin data — never statically cached. Gate + shell come from the
// (network) route-group layout, same as Users / Matches / Surveys.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Founding Members — HAEVN Admin',
}

export default function FoundingMembersPage() {
  return <FoundingMembersClient />
}
