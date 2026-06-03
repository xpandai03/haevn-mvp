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

import { useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { User, MapPin, MessageCircle, Lock, X, Check, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReadyToMeetUiState } from '@/lib/types/readyToMeet'
import { ReadyToMeetButton } from '@/components/dashboard/ReadyToMeetButton'

/** Portrait photo for match cards (matches the Emergent demo's 3/4 ratio) */
const MATCH_PHOTO_H = 'aspect-[3/4]'

export type ProfileCardVariant = 'match' | 'connection' | 'nudge'

export interface ProfileCardData {
  id: string
  photo?: string
  /** Display name or handle — used for alt text and fallbacks */
  username: string
  /** Preferred given name for headings (e.g. from partnership display_name) */
  firstName?: string
  age?: number
  city?: string
  /** Distance in miles (when geodata exists) */
  distance?: number
  gender?: string | null
  sexuality?: string | null
  relationshipStructure?: string | null
  compatibilityPercentage: number
  topFactor: string
  /** Written 2-3 line AI intro paragraph (preferred over topFactor when present) */
  intro?: string
  /** "Where you might differ" contrast line (muted, below the intro) */
  contrast?: string
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
  /**
   * When set on variant `match`, shows Ready to Meet control (HAEVN+ only;
   * parent should omit when `isLocked`).
   */
  readyToMeet?: {
    state: ReadyToMeetUiState
    otherPartnershipId: string
  }
  /**
   * When provided on variant `match` (and not locked), renders a Pass (X)
   * control that hides the match. Receives the profile id.
   */
  onPass?: (id: string) => void
  /** Connection status for the match action row. */
  connectionStatus?: 'none' | 'pending' | 'connected'
  /** Handshake id (when connected) — used by the Message action. */
  handshakeId?: string | null
  /** True when the matched partnership is on the free plan (drives Nudge flow). */
  matchIsFreeTier?: boolean
  /** Locked (free-viewer) card: this match has nudged the viewer. */
  hasNudgedYou?: boolean
  /** Action callbacks for the match action row. */
  onConnect?: (id: string) => void
  onNudge?: (id: string) => void
  onMessage?: (handshakeId: string) => void
}

function redactName(name: string) {
  if (!name) return '—'
  const first = name.trim().charAt(0)
  return first ? `${first.toUpperCase()}***` : '—'
}

function cardFirstName(profile: ProfileCardData): string {
  if (profile.firstName?.trim()) return profile.firstName.trim()
  const raw = profile.username?.trim()
  if (!raw) return 'Member'
  const firstSegment = raw.split(/[\s_]+/).filter(Boolean)[0]
  if (!firstSegment) return 'Member'
  const lower = firstSegment.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

function formatDemographicsLine(profile: ProfileCardData): string | null {
  const parts: string[] = []
  if (profile.gender?.trim()) parts.push(profile.gender.trim())
  if (profile.sexuality?.trim()) parts.push(profile.sexuality.trim())
  if (profile.relationshipStructure?.trim()) {
    parts.push(profile.relationshipStructure.trim())
  }
  if (profile.distance != null && profile.distance >= 0) {
    parts.push(`${profile.distance} miles away`)
  } else if (profile.city?.trim()) {
    parts.push(profile.city.trim())
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function SilhouetteOverlay({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'w-full bg-gradient-to-b from-haevn-warm-gray to-[#D5D3D0] flex items-center justify-center relative overflow-hidden',
        className ?? 'aspect-[3/4]'
      )}
    >
      <svg viewBox="0 0 200 200" className="w-28 h-28 opacity-30" aria-hidden>
        <circle cx="100" cy="70" r="40" fill="#9CA3AF" />
        <ellipse cx="100" cy="170" rx="60" ry="50" fill="#9CA3AF" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] tracking-[0.12em] uppercase text-[color:var(--haevn-muted-fg)] bg-white/75 backdrop-blur-sm px-3 py-1.5 flex items-center gap-1.5">
          <Lock size={12} strokeWidth={1.5} />
          Unlock to Connect
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
  readyToMeet,
  onPass,
  connectionStatus = 'none',
  handshakeId,
  matchIsFreeTier = false,
  hasNudgedYou = false,
  onConnect,
  onNudge,
  onMessage,
}: ProfileCardProps) {
  const [expandedPhoto, setExpandedPhoto] = useState<string | null>(null)
  const given = cardFirstName(profile)
  const displayAge =
    profile.age != null && profile.age > 0 ? profile.age : undefined
  const base = isLocked ? redactName(given) : given
  const nameHeading =
    displayAge != null ? `${base}, ${displayAge}` : base

  // --- MATCH variant: the flagship 3/4-photo architectural card --- //
  if (variant === 'match') {
    return (
      <div className="dash-card group relative flex flex-col w-full h-full min-h-[500px] overflow-hidden transition-colors duration-200 hover:border-[color:var(--haevn-teal)]/40">
        {!isLocked && onPass && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onPass(profile.id)
            }}
            aria-label="Pass on this match"
            className="keep-rounded absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center bg-white/90 text-red-400 shadow-sm transition-colors hover:bg-white hover:text-red-600"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onClick(profile.id)}
          className="flex flex-1 min-h-0 w-full flex-col overflow-hidden text-left"
        >
          {/* Photo / silhouette — portrait 3/4. Click expands (not navigate). */}
          <div className={cn('shrink-0 w-full overflow-hidden', MATCH_PHOTO_H)}>
            {isLocked || !profile.photo ? (
              <SilhouetteOverlay className={MATCH_PHOTO_H} />
            ) : (
              <div
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation()
                  setExpandedPhoto(profile.photo!)
                }}
                className={cn(
                  'w-full overflow-hidden cursor-zoom-in',
                  MATCH_PHOTO_H
                )}
              >
                <img
                  src={profile.photo}
                  alt={profile.username}
                  className="w-full h-full object-cover object-[center_25%] transition-transform duration-500 group-hover:scale-[1.02]"
                />
              </div>
            )}
          </div>

          {/* Body — fills remainder; overflow hidden keeps row height stable */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-4">
            {/* Nudge-received banner (locked / free-viewer cards) */}
            {isLocked && hasNudgedYou && (
              <div className="-mx-4 -mt-4 mb-1 shrink-0 border-b border-[rgba(226,158,12,0.2)] bg-[rgba(226,158,12,0.1)] px-4 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[color:var(--haevn-gold)]">
                  Nudge received
                </p>
                <p className="mt-0.5 text-xs text-[color:var(--haevn-charcoal)]/60">
                  This HAEVN+ member wants to connect with you. Upgrade to
                  respond.
                </p>
              </div>
            )}
            <div className="min-w-0 shrink-0">
              <h3 className="font-heading text-xl text-[color:var(--haevn-navy)] leading-tight truncate">
                {nameHeading}
              </h3>
              {!isLocked && formatDemographicsLine(profile) && (
                <p className="mt-1 text-sm text-[color:var(--haevn-charcoal)]/60 truncate">
                  {formatDemographicsLine(profile)}
                </p>
              )}
            </div>

            <div className="flex items-baseline gap-2 shrink-0">
              <span className="font-heading text-3xl text-[color:var(--haevn-gold)] tabular-nums">
                {profile.compatibilityPercentage}%
              </span>
              <span className="text-[11px] tracking-[0.14em] uppercase text-[color:var(--haevn-muted-fg)]">
                Match
              </span>
            </div>

            {!isLocked && profile.signals && profile.signals.length > 0 && (
              <div className="flex flex-wrap gap-1.5 min-h-0 max-h-[2.75rem] overflow-hidden">
                {profile.signals.slice(0, 3).map((signal) => (
                  <span
                    key={signal}
                    className="text-[11px] tracking-wide text-[color:var(--haevn-teal)] bg-[rgba(0,128,128,0.08)] border border-[rgba(0,128,128,0.15)] px-2.5 py-0.5 max-w-full truncate"
                  >
                    {signal}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-auto min-h-0">
              <p className="text-[14px] text-[color:var(--haevn-charcoal)] leading-relaxed italic line-clamp-3">
                {isLocked
                  ? 'Full match context is available to HAEVN+ members.'
                  : profile.intro || profile.topFactor}
              </p>
              {isLocked && (
                <button
                  type="button"
                  className="mt-1 text-xs text-[color:var(--haevn-teal)] hover:text-[color:var(--haevn-teal-hover)]"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick(profile.id)
                  }}
                >
                  Unlock to read more
                </button>
              )}
            </div>

            {!isLocked && profile.contrast && (
              <p className="shrink-0 text-xs italic text-[color:var(--haevn-charcoal)]/40">
                Where you might differ: {profile.contrast}
              </p>
            )}

            {isLocked && (
              <p className="text-[12px] text-[color:var(--haevn-muted-fg)] pt-2 border-t border-[color:var(--haevn-border)] shrink-0">
                Tap the card or upgrade below to unlock photos, profiles, and messaging.
              </p>
            )}
          </div>
        </button>

        {/* Footer (siblings of the clickable button — no nested buttons) */}
        {!isLocked && (readyToMeet || connectionStatus || matchIsFreeTier) && (
          <div className="shrink-0 space-y-3 border-t border-[color:var(--haevn-border)] p-4">
            {readyToMeet && (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.14em] text-[color:var(--haevn-muted-fg)]">
                  Meet IRL
                </p>
                <ReadyToMeetButton
                  otherPartnershipId={readyToMeet.otherPartnershipId}
                  initialState={readyToMeet.state}
                />
              </div>
            )}

            {/* Action row */}
            {connectionStatus === 'connected' ? (
              <button
                type="button"
                onClick={() => handshakeId && onMessage?.(handshakeId)}
                className="flex w-full items-center justify-center gap-2 bg-[color:var(--haevn-teal)] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--haevn-teal-hover)]"
              >
                <MessageCircle size={15} strokeWidth={2} /> Message
              </button>
            ) : connectionStatus === 'pending' ? (
              <div className="flex w-full items-center justify-center gap-2 bg-[color:var(--haevn-dash-surface-alt)] py-2.5 text-sm font-medium text-[color:var(--haevn-muted-fg)]">
                <Check size={15} strokeWidth={2} /> Request sent
              </div>
            ) : matchIsFreeTier ? (
              <div>
                <button
                  type="button"
                  onClick={() => onNudge?.(profile.id)}
                  className="flex w-full items-center justify-center gap-2 bg-[color:var(--haevn-navy)] py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90"
                >
                  <Bell size={15} strokeWidth={2} /> Nudge to Connect
                </button>
                <p className="mt-2 text-center text-[11px] leading-relaxed text-[color:var(--haevn-charcoal)]/60">
                  {given} is on the free plan. Nudge to invite them to upgrade.
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => onConnect?.(profile.id)}
                className="haevn-btn-gold w-full text-sm"
              >
                Connect
              </button>
            )}
          </div>
        )}

        {/* Photo lightbox */}
        {expandedPhoto && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
            onClick={() => setExpandedPhoto(null)}
            role="dialog"
            aria-modal="true"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={expandedPhoto}
              alt={profile.username}
              className="max-h-[90vh] max-w-[90vw] object-contain"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setExpandedPhoto(null)
              }}
              aria-label="Close"
              className="absolute right-6 top-6 text-2xl text-white/70 transition-colors hover:text-white"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    )
  }

  // --- NUDGE variant: gold-stripe Emergent-style panel --- //
  if (variant === 'nudge') {
    return (
      <Card
        onClick={() => onClick(profile.id)}
        className={cn(
          'flex-shrink-0 w-[85vw] sm:w-[360px] max-w-full cursor-pointer overflow-hidden border border-[color:var(--haevn-border)] border-l-[5px] border-l-[color:var(--haevn-gold)] bg-white p-0 shadow-sm transition-colors duration-200 hover:border-[color:var(--haevn-teal)]/40'
        )}
      >
        <div className="bg-[rgba(226,158,12,0.14)] px-4 py-3 border-b border-[color:var(--haevn-border)]">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[color:var(--haevn-gold)]">
            NUDGE RECEIVED
          </p>
          <p className="text-sm font-semibold text-[color:var(--haevn-navy)] mt-2 leading-snug">
            This HAEVN+ member wants to connect with you.
          </p>
          <p className="text-sm font-semibold text-[color:var(--haevn-charcoal)] mt-1.5">
            Upgrade to respond.
          </p>
        </div>

        <div className="p-5">
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
                {nameHeading}
              </h3>
              {formatDemographicsLine(profile) && !isLocked ? (
                <div className="flex items-start gap-1 text-[color:var(--haevn-muted-fg)] mt-1">
                  <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span className="text-sm line-clamp-2">
                    {formatDemographicsLine(profile)}
                  </span>
                </div>
              ) : (
                !isLocked &&
                (profile.city || profile.distance !== undefined) && (
                  <div className="flex items-center gap-1 text-[color:var(--haevn-muted-fg)] mt-1">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm truncate">
                      {profile.distance !== undefined
                        ? `${profile.distance} miles away`
                        : profile.city}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="mb-1">
            <div className="flex items-baseline gap-2 mb-2">
              <div className="font-heading text-4xl sm:text-5xl text-[color:var(--haevn-teal)] tabular-nums">
                {profile.compatibilityPercentage}%
              </div>
              <span className="text-sm text-[color:var(--haevn-muted-fg)]">
                match
              </span>
            </div>
            <p className="text-sm text-[color:var(--haevn-charcoal)] leading-relaxed">
              {isLocked
                ? 'Full details are visible to HAEVN+ members.'
                : profile.topFactor}
            </p>
          </div>

          {nudgedAt && (
            <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-3 pt-3 border-t border-[color:var(--haevn-border)]">
              Nudged {getNudgeAgeText(nudgedAt)}
            </p>
          )}
        </div>
      </Card>
    )
  }

  // --- CONNECTION variant --- //
  return (
    <Card
      onClick={() => onClick(profile.id)}
      className={cn(
        'w-full max-w-full shrink-0 cursor-pointer border border-[color:var(--haevn-border)] bg-white p-5 shadow-none transition-colors duration-200 hover:border-[color:var(--haevn-teal)]/40 sm:w-full'
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
            {nameHeading}
          </h3>
          {formatDemographicsLine(profile) && !isLocked ? (
            <div className="flex items-start gap-1 text-[color:var(--haevn-muted-fg)] mt-1">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="text-sm line-clamp-2">{formatDemographicsLine(profile)}</span>
            </div>
          ) : (
            !isLocked &&
            (profile.city || profile.distance !== undefined) && (
              <div className="flex items-center gap-1 text-[color:var(--haevn-muted-fg)] mt-1">
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm truncate">
                  {profile.distance !== undefined
                    ? `${profile.distance} miles away`
                    : profile.city}
                </span>
              </div>
            )
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
          {isLocked
            ? 'Full details are visible to HAEVN+ members.'
            : profile.topFactor}
        </p>
      </div>

      {latestMessage && (
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
    </Card>
  )
}
