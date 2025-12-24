'use client'

import { useRouter } from 'next/navigation'
import { MessageSquare, User, FileText, Calendar, BookOpen, GraduationCap, ChevronRight, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  sublabel?: string
  href: string
  disabled?: boolean
  onClick: () => void
}

function NavItem({ icon, label, sublabel, disabled, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-3 w-full p-3 rounded-xl transition-colors text-left ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'hover:bg-haevn-lightgray active:bg-haevn-lightgray/80'
      }`}
    >
      <div className="flex-shrink-0 text-haevn-charcoal/70">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium text-haevn-navy"
          style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
        >
          {label}
        </p>
        {sublabel && (
          <p
            className="text-xs text-haevn-charcoal/60"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
          >
            {sublabel}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-haevn-charcoal/40 flex-shrink-0" />
    </button>
  )
}

interface DashboardNavigationProps {
  membershipTier?: 'free' | 'plus'
}

export function DashboardNavigation({ membershipTier = 'free' }: DashboardNavigationProps) {
  const router = useRouter()
  const isPro = membershipTier === 'plus'

  return (
    <div className="space-y-3">
      {/* Personal Section */}
      <Card className="rounded-2xl border-haevn-navy/10 shadow-sm">
        <CardContent className="p-2">
          <h3
            className="text-xs font-semibold text-haevn-charcoal/60 uppercase tracking-wider px-3 py-2"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
          >
            Personal
          </h3>
          <div className="space-y-0.5">
            {isPro ? (
              <NavItem
                icon={<MessageSquare className="h-5 w-5" />}
                label="Messages"
                sublabel="Chat with connections"
                href="/messages"
                onClick={() => router.push('/messages')}
              />
            ) : (
              <NavItem
                icon={<Sparkles className="h-5 w-5" />}
                label="Upgrade Account"
                sublabel="Unlock messaging & more"
                href="/onboarding/membership"
                onClick={() => router.push('/onboarding/membership')}
              />
            )}
            <NavItem
              icon={<User className="h-5 w-5" />}
              label="Account Details"
              sublabel="Manage your account"
              href="/account-details"
              onClick={() => router.push('/account-details')}
            />
            <NavItem
              icon={<FileText className="h-5 w-5" />}
              label="Survey"
              sublabel="View & update responses"
              href="/survey-results"
              onClick={() => router.push('/survey-results')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Resources Section */}
      <Card className="rounded-2xl border-haevn-navy/10 shadow-sm">
        <CardContent className="p-2">
          <h3
            className="text-xs font-semibold text-haevn-charcoal/60 uppercase tracking-wider px-3 py-2"
            style={{ fontFamily: 'Roboto, Helvetica, sans-serif' }}
          >
            Resources & Community
          </h3>
          <div className="space-y-0.5">
            <NavItem
              icon={<Calendar className="h-5 w-5" />}
              label="Events"
              sublabel="Coming soon"
              href="/events"
              disabled
              onClick={() => {}}
            />
            <NavItem
              icon={<BookOpen className="h-5 w-5" />}
              label="Glossary"
              sublabel="Coming soon"
              href="/glossary"
              disabled
              onClick={() => {}}
            />
            <NavItem
              icon={<GraduationCap className="h-5 w-5" />}
              label="Learn"
              sublabel="Coming soon"
              href="/learn"
              disabled
              onClick={() => {}}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
