import { User, CheckCircle2, Clock, AlertCircle, Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { OnboardingProgress } from './OnboardingProgress'
import { cn } from '@/lib/utils'
import type { PartnerListProps, PartnerStatus } from '@/lib/types/dashboard'

const statusConfig: Record<PartnerStatus, {
  label: string
  icon: typeof CheckCircle2
  className: string
  badgeClassName: string
}> = {
  completed: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'text-green-600',
    badgeClassName: 'bg-green-100 text-green-700 border-green-200'
  },
  in_progress: {
    label: 'In Progress',
    icon: Clock,
    className: 'text-yellow-600',
    badgeClassName: 'bg-yellow-100 text-yellow-700 border-yellow-200'
  },
  not_started: {
    label: 'Not Started',
    icon: AlertCircle,
    className: 'text-gray-500',
    badgeClassName: 'bg-gray-100 text-gray-600 border-gray-200'
  },
  invite_pending: {
    label: 'Invite Pending',
    icon: Mail,
    className: 'text-blue-500',
    badgeClassName: 'bg-blue-100 text-blue-600 border-blue-200'
  }
}

export function PartnerList({ partners, currentUserId }: PartnerListProps) {
  if (partners.length === 0) {
    return (
      <div className="text-center py-4 text-haevn-charcoal/60 text-sm">
        No partners yet
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {partners.map((partner) => {
        const isCurrentUser = partner.userId === currentUserId
        const config = statusConfig[partner.status]
        const StatusIcon = config.icon

        const initials = partner.name
          .split(' ')
          .map(n => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)

        return (
          <div
            key={partner.userId}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl',
              isCurrentUser ? 'bg-haevn-teal/5 border border-haevn-teal/20' : 'bg-haevn-lightgray'
            )}
          >
            {/* Avatar */}
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-white text-haevn-navy text-sm font-medium">
                {initials || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>

            {/* Partner Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-haevn-navy font-medium truncate"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500,
                    fontSize: '14px'
                  }}
                >
                  {partner.name}
                  {isCurrentUser && (
                    <span className="text-haevn-charcoal/50 font-normal ml-1">(You)</span>
                  )}
                </span>
                <Badge
                  variant="outline"
                  className="rounded-full text-xs border-haevn-navy/30 px-2 py-0"
                >
                  {partner.role === 'owner' ? 'Owner' : 'Member'}
                </Badge>
              </div>

              {/* Show progress if in progress */}
              {partner.status === 'in_progress' && (
                <div className="mt-1.5">
                  <OnboardingProgress
                    percentage={partner.onboardingCompletion}
                    size="sm"
                    showPercentage={false}
                  />
                </div>
              )}
            </div>

            {/* Status Badge */}
            <div className="flex items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn('rounded-full text-xs', config.badgeClassName)}
              >
                <StatusIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}
