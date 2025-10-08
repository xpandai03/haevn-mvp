'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/context'
import { getUserNudges, NudgeItem } from '@/lib/actions/nudges'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ArrowLeft, Bell, Heart, Sparkles, CheckCircle } from 'lucide-react'
import { HaevnLogo } from '@/components/HaevnLogo'

export default function NudgesPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [nudges, setNudges] = useState<NudgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    async function loadNudges() {
      if (!user) return

      try {
        setLoading(true)
        const { data, error: nudgesError } = await getUserNudges()
        if (nudgesError) {
          setError(nudgesError)
        } else {
          setNudges(data)
        }
      } catch (err: any) {
        console.error('Error loading nudges:', err)
        setError(err.message || 'Failed to load notifications')
      } finally {
        setLoading(false)
      }
    }

    loadNudges()
  }, [user])

  const groupByDate = (nudges: NudgeItem[]) => {
    const groups: { [key: string]: NudgeItem[] } = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      Older: []
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const thisWeek = new Date(today)
    thisWeek.setDate(thisWeek.getDate() - 7)

    nudges.forEach(nudge => {
      const nudgeDate = new Date(nudge.created_at)
      const nudgeDay = new Date(nudgeDate.getFullYear(), nudgeDate.getMonth(), nudgeDate.getDate())

      if (nudgeDay.getTime() === today.getTime()) {
        groups.Today.push(nudge)
      } else if (nudgeDay.getTime() === yesterday.getTime()) {
        groups.Yesterday.push(nudge)
      } else if (nudgeDate >= thisWeek) {
        groups['This Week'].push(nudge)
      } else {
        groups.Older.push(nudge)
      }
    })

    return groups
  }

  const getNudgeIcon = (type: NudgeItem['type']) => {
    switch (type) {
      case 'handshake_received':
        return <Bell className="h-5 w-5 text-[#E29E0C]" />
      case 'handshake_accepted':
        return <Heart className="h-5 w-5 text-[#008080]" />
      case 'section_completed':
        return <CheckCircle className="h-5 w-5 text-[#E29E0C]" />
      default:
        return <Sparkles className="h-5 w-5 text-[#252627]" />
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }

  const handleNudgeClick = (nudge: NudgeItem) => {
    if (nudge.link) {
      router.push(nudge.link)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#008080]" />
          <p className="text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            Loading notifications...
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#E8E6E3] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-6 border-2 border-[#252627]/10">
          <h2 className="text-h2 text-red-600 mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
            Error Loading Notifications
          </h2>
          <p className="text-body text-[#252627]/70 mb-4" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
            {error}
          </p>
          <Button
            onClick={() => window.location.reload()}
            className="w-full bg-gradient-to-r from-[#E29E0C] to-[#D88A0A]"
          >
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const groupedNudges = groupByDate(nudges)

  return (
    <div className="min-h-screen bg-[#E8E6E3]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="text-[#252627] hover:text-[#008080]"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </Button>
            <HaevnLogo size="sm" />
          </div>

          <div>
            <h1 className="text-h1 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
              Nudges
            </h1>
            <p className="text-body text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
              Stay updated with your activity and connections
            </p>
          </div>
        </div>

        {/* Nudges List */}
        {nudges.length === 0 ? (
          <Card className="text-center py-16 border-2 border-dashed border-[#252627]/20">
            <CardContent className="pt-6">
              <Bell className="h-16 w-16 mx-auto text-[#252627]/30 mb-4" />
              <h3 className="text-h3 text-[#252627] mb-2" style={{ fontFamily: 'Roboto', fontWeight: 900 }}>
                No notifications yet
              </h3>
              <p className="text-body text-[#252627]/60" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                Check back later for updates on your matches and connections.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedNudges).map(([group, items]) => {
              if (items.length === 0) return null

              return (
                <div key={group}>
                  {/* Group Header */}
                  <h2 className="text-sm text-[#252627]/50 mb-3 font-medium uppercase tracking-wide" style={{ fontFamily: 'Roboto', fontWeight: 500 }}>
                    {group}
                  </h2>

                  {/* Nudge Items */}
                  <div className="space-y-3">
                    {items.map((nudge) => (
                      <Card
                        key={nudge.id}
                        className="bg-white border-2 border-[#252627]/10 hover:border-[#008080]/30 transition-all cursor-pointer"
                        onClick={() => handleNudgeClick(nudge)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#E8E6E3] flex items-center justify-center">
                              {getNudgeIcon(nudge.type)}
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-semibold text-[#252627] mb-1" style={{ fontFamily: 'Roboto', fontWeight: 700 }}>
                                {nudge.title}
                              </h3>
                              <p className="text-sm text-[#252627]/70" style={{ fontFamily: 'Roboto', fontWeight: 300 }}>
                                {nudge.description}
                              </p>
                              <p className="text-xs text-[#252627]/50 mt-2" style={{ fontFamily: 'Roboto', fontWeight: 400 }}>
                                {formatTime(nudge.created_at)}
                              </p>
                            </div>

                            {/* Unread indicator */}
                            {!nudge.read && (
                              <div className="flex-shrink-0 w-2 h-2 rounded-full bg-[#E29E0C]" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
