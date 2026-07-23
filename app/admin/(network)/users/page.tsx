import { UsersClient } from '@/components/admin/users/UsersClient'

// Live admin data — never statically cached.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Users — HAEVN Admin',
}

export default function UsersPage() {
  return <UsersClient />
}
