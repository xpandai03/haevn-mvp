import { Badge } from '@/components/ui/badge'
import { Sparkles } from 'lucide-react'

interface TierBadgeProps {
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
  size?: 'sm' | 'md' | 'lg'
}

const tierConfig = {
  Platinum: {
    bg: 'bg-purple-100',
    text: 'text-purple-700',
    border: 'border-purple-300',
    icon: 'text-purple-600'
  },
  Gold: {
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-300',
    icon: 'text-yellow-600'
  },
  Silver: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    border: 'border-gray-300',
    icon: 'text-gray-600'
  },
  Bronze: {
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    border: 'border-orange-300',
    icon: 'text-orange-600'
  }
}

export function TierBadge({ tier, size = 'md' }: TierBadgeProps) {
  const config = tierConfig[tier]
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm'

  return (
    <Badge
      variant="outline"
      className={`${config.bg} ${config.text} ${config.border} border ${textSize} font-medium px-2 py-0.5 flex items-center gap-1`}
    >
      <Sparkles className={`${iconSize} ${config.icon}`} />
      {tier}
    </Badge>
  )
}
