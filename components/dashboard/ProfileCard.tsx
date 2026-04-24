'use client'

/**
 * ProfileCard — reskinned to the architectural aesthetic (sharp corners,
 * Cabinet Grotesk headings, cream/white surfaces, teal accents).
 *
 * Three variants kept for backward compatibility:
 *   - match      (the Emergent-style 3/4-photo card, big compat %, signals)
 *   - connection (compact horizontal card with latest message preview)
 *   - nudge      (compact horizontal card with nudge age)
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { User, MapPin, MessageCircle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ProfileCardVariant = 'match' | 'connection' | 'nudge'

export interface ProfileCardData {
  id: string
  photo?: string
  username: string
  city?: string
  distance?: number
  compatibilityPercentage: number
  topFactor: string
  /** Optional supporting tags — Emergent "top signals" surface */
  signals?: string[]
}

export interface ProfileCardProps {
  profile: ProfileCardData
  variant: ProfileCardVariant
  onClick: (id: string) => void
  // Variant-specific props
  latestMessage?: string
  unreadCount?: number
  nudgedAt?: Date
  /**
   * Tier-gating flag. When true, the viewer is free-tier and the card
   * should render the Member view (silhouette photo + redacted name +
   * upgrade affordance). Off by default (backward-compatible).
   */
  isLocked?: boolean
}

function redactName(name: string) {
  if (!name) return '—'
  const first = name.trim().charAt(0)
  return first ? `${first.toUpperCase()}***` : '—'
}

function SilhouetteOverlay() {
  return (
    <div className="w-full aspect-[3/4] bg-gradient-to-b from-[#E8E6E3] to-[#D5D3D0] flex items-center justify-center relative overflow-hidden">
      <svg viewBox="0 0 200 200" className="w-28 h-28 opacity-30" aria-hidden>
        <circle cx="100" cy="70" r="40" fill="#9CA3AF" />
        <ellipse cx="100" cy="170" rx="60" ry="50" fill="#9CA3AF" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] tracking-[0.12em] uppercase text-[#6B7280] bg-white/75 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5">
          <Lock size={12} strokeWidth={1.5} />
          Upgrade to view
        </span>
      </div>
    </div>
  )
}

function getNudgeAgeText(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${Math.floor(diffHours)} hours ago`
  if (diffDays <= 7) return `${Math.floor(diffDays)} days ago`
  return 'A week ago'
}

export function ProfileCard({
  profile,
  variant,
  onClick,
  latestMessage,
  unreadCount,
  nudgedAt,
  isLocked = false,
}: ProfileCardProps) {
  const displayName = isLocked ? redactName(profile.username) : profile.username

  // --- MATCH variant: the flagship 3/4-photo architectural card --- //
  if (variant === 'match') {
    return (
      <button
        type="button"
        onClick={() => onClick(profile.id)}
        className="dash-card group flex flex-col w-full text-left overflow-hidden transition-colors duration-200 hover:border-[color:var(--haevn-teal)]/40"
      >
        {/* Photo / silhouette */}
        <div className="shrink-0">
          {isLocked || !profile.photo ? (
            <SilhouetteOverlay />
          ) : (
            <div className="w-full aspect-[3/4] overflow-hidden">
              <img
                src={profile.photo}
                alt={profile.username}
                className="w-full h-full object-cover object-[center_25%] transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-3">
          <div>
            <h3 className="font-heading text-xl text-[color:var(--haevn-navy)] leading-tight">
              {displayName}
            </h3>
            {(profile.city || profile.distance !== undefined) && (
              <p className="mt-1 text-[13px] text-[color:var(--haevn-muted-fg)]">
                {profile.distance !== undefined
                  ? `${profile.distance} mi away`
                  : profile.city}
              </p>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <span className="font-heading text-3xl text-[color:var(--haevn-gold)] tabular-nums">
              {profile.compatibilityPercentage}%
            </span>
            <span className="text-[11px] tracking-[0.14em] uppercase text-[color:var(--haevn-muted-fg)]">
              Match
            </span>
          </div>

          {profile.signals && profile.signals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {profile.signals.slice(0, 3).map((signal) => (
                <span
                  key={signal}
                  className="text-[11px] tracking-wide text-[color:var(--haevn-teal)] bg-[rgba(0,128,128,0.08)] border border-[rgba(0,128,128,0.15)] px-2.5 py-0.5"
                >
                  {signal}
                </span>
              ))}
            </div>
          )}

          <p className="text-[14px] text-[color:var(--haevn-charcoal)] leading-relaxed italic line-clamp-3">
            {profile.topFactor}
          </p>

          {isLocked && (
            <p className="text-[12px] text-[color:var(--haevn-muted-fg)] pt-2 border-t border-[color:var(--haevn-border)]">
              Upgrade to HAEVN+ to view photos, connect, and message.
            </p>
          )}
        </div>
      </button>
    )
  }

  // --- CONNECTION / NUDGE variants: compact horizontal card --- //
  return (
    <Card
      onClick={() => onClick(profile.id)}
      className={cn(
        'flex-shrink-0 w-[85vw] sm:w-[320px] cursor-pointer bg-white border border-[color:var(--haevn-border)] p-5 transition-colors duration-200 hover:border-[color:var(--haevn-teal)]/40'
      )}
    >
      {/* Top: avatar + name */}
      <div className="flex items-start gap-4 mb-4">
        <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-[color:var(--haevn-teal)] flex-shrink-0 keep-rounded">
          {profile.photo && !isLocked ? (
            <AvatarImage src={profile.photo} alt={profile.username} />
          ) : (
            <AvatarFallback className="bg-[rgba(0,128,128,0.1)] keep-rounded">
              <User className="h-8 w-8 sm:h-10 sm:w-10 text-[color:var(--haevn-teal)]" />
            </AvatarFallback>
          )}
        </Avatar>

        <div className="flex-1 min-w-0">
          <h3 className="font-heading text-lg text-[color:var(--haevn-navy)] truncate">
            {displayName}
          </h3>
          {(profile.city || profile.distance !== undefined) && (
            <div className="flex items-center gap-1 text-[color:var(--haevn-muted-fg)] mt-1">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm truncate">
                {profile.distance !== undefined
                  ? `${profile.distance} mi away`
                  : profile.city}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Compat */}
      <div className="mb-4">
        <div className="flex items-baseline gap-2 mb-2">
          <div className="font-heading text-4xl sm:text-5xl text-[color:var(--haevn-teal)] tabular-nums">
            {profile.compatibilityPercentage}%
          </div>
          <span className="text-sm text-[color:var(--haevn-muted-fg)]">
            match
          </span>
        </div>
        <p className="text-sm text-[color:var(--haevn-charcoal)] leading-relaxed">
          {profile.topFactor}
        </p>
      </div>

      {/* Variant-specific footer */}
      {variant === 'connection' && latestMessage && (
        <div className="mt-4 pt-4 border-t border-[color:var(--haevn-border)]">
          <div className="flex items-start gap-2">
            <MessageCircle className="h-4 w-4 text-[color:var(--haevn-charcoal)] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[color:var(--haevn-charcoal)] line-clamp-2 flex-1">
              {latestMessage}
            </p>
            {unreadCount && unreadCount > 0 && (
              <Badge className="keep-rounded bg-[color:var(--haevn-gold)] text-white flex-shrink-0">
                {unreadCount}
              </Badge>
            )}
          </div>
        </div>
      )}

      {variant === 'nudge' && nudgedAt && (
        <div className="mt-4 pt-4 border-t border-[color:var(--haevn-border)]">
          <p className="text-sm text-[color:var(--haevn-charcoal)]">
            Nudged {getNudgeAgeText(nudgedAt)}
          </p>
          <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-1">
            Reply → Upgrade to respond
          </p>
        </div>
      )}
    </Card>
  )
}
