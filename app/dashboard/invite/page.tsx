import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { loadDashboardData } from '@/lib/dashboard/loadDashboardData'
import InvitePartnerCard from '@/components/dashboard/InvitePartnerCard'

export default async function InvitePage() {
  const data = await loadDashboardData()

  // Redirect to login if not authenticated
  if (!data) {
    redirect('/auth/login')
  }

  // Redirect if no partnership exists
  if (!data.partnership) {
    redirect('/onboarding/identity')
  }

  return (
    <div className="min-h-screen bg-haevn-lightgray">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-haevn-gray-200 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-haevn-lightgray transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-haevn-charcoal" />
          </Link>
          <h1
            className="text-lg font-semibold text-haevn-navy"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 600
            }}
          >
            Invite Partner
          </h1>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-lg mx-auto px-4 py-6">
        <InvitePartnerCard />
      </main>
    </div>
  )
}
