import { NetworkPerformanceClient } from '@/components/admin/network/NetworkPerformanceClient'

// Live admin data — never statically cached.
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Network Performance — HAEVN Admin',
}

export default function NetworkPerformancePage() {
  return <NetworkPerformanceClient />
}
