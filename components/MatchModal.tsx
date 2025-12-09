'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { MapPin, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MatchModalProps {
  match: {
    partnership: {
      id: string
      display_name: string | null
      short_bio: string | null
      identity: string
      city: string
      age: number
      discretion_level: string
    }
    score: number
    tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze'
    breakdown: any
  } | null
  open: boolean
  onClose: () => void
  onConnect?: (partnershipId: string) => void
}

const TIER_COLORS = {
  Platinum: 'bg-gradient-to-br from-haevn-teal-500 to-haevn-teal-700 text-white',
  Gold: 'bg-gradient-to-br from-haevn-orange-400 to-haevn-orange-600 text-white',
  Silver: 'bg-gradient-to-br from-haevn-gray-300 to-haevn-gray-500 text-white',
  Bronze: 'bg-gradient-to-br from-haevn-orange-700 to-haevn-orange-900 text-white',
}

const TIER_BADGE_COLORS = {
  Platinum: 'bg-haevn-teal-50 text-haevn-teal-800 border-haevn-teal-200',
  Gold: 'bg-haevn-orange-50 text-haevn-orange-800 border-haevn-orange-200',
  Silver: 'bg-haevn-gray-100 text-haevn-gray-700 border-haevn-gray-300',
  Bronze: 'bg-haevn-orange-100 text-haevn-orange-900 border-haevn-orange-300',
}

export function MatchModal({ match, open, onClose, onConnect }: MatchModalProps) {
  if (!match) return null

  const { partnership, score, tier, breakdown } = match
  const initials = partnership.display_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '??'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Match Details</DialogTitle>
        </DialogHeader>

        {/* Header with avatar */}
        <div className="flex items-start gap-6 mb-6">
          <div className={`w-24 h-24 rounded-full ${TIER_COLORS[tier]} flex items-center justify-center text-display-md flex-shrink-0`}>
            {initials}
          </div>

          <div className="flex-1">
            <h2 className="text-display-sm text-haevn-gray-900 mb-2">
              {partnership.display_name || 'Anonymous'}
            </h2>
            <div className="flex items-center gap-2 text-body text-haevn-gray-600 mb-2">
              <span className="capitalize">{partnership.identity}</span>
              <span>•</span>
              <span>{partnership.age} years old</span>
            </div>
            <div className="flex items-center gap-1 text-body-sm text-haevn-gray-600">
              <MapPin className="h-4 w-4" />
              <span>{partnership.city}</span>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Score */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Compatibility Score</p>
              <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-500" />
                <span className="text-4xl font-bold text-purple-600">{score}%</span>
              </div>
            </div>
            <Badge className={`text-lg px-4 py-2 ${TIER_BADGE_COLORS[tier]}`}>
              {tier} Match
            </Badge>
          </div>
        </div>

        {/* Bio */}
        {partnership.short_bio && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">About</h3>
            <p className="text-muted-foreground">{partnership.short_bio}</p>
          </div>
        )}

        {/* Score Breakdown */}
        <div className="mb-6">
          <h3 className="font-semibold mb-3">Compatibility Breakdown</h3>
          <div className="space-y-3">
            {breakdown && Object.entries(breakdown.raw_sections || {}).map(([key, data]: [string, any]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm capitalize">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm font-medium">
                      {Math.round(data.contribution)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                      style={{ width: `${(data.contribution / (data.weight * 100)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy info */}
        <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
          <p className="font-medium mb-1">Privacy Level: {partnership.discretion_level}</p>
          <p className="text-xs">
            Connect to learn more about each other
          </p>
        </div>

        {/* Action buttons - CONNECT / PASS */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-gray-300 text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            PASS
          </Button>
          <Button
            className="flex-1 bg-[#1B9A9A] hover:bg-[#178787] text-white font-semibold"
            onClick={() => {
              if (onConnect) {
                onConnect(partnership.id)
              }
              onClose()
            }}
          >
            CONNECT
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
