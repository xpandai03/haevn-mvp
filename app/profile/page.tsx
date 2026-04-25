import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronRight,
  Camera,
  CheckCircle2,
  User as UserIcon,
  Mail,
  Lock,
  Shield,
  AlertTriangle,
} from 'lucide-react'
import { loadDashboardData } from '@/lib/dashboard/loadDashboardData'
import { createAdminClient } from '@/lib/supabase/admin'
import { getConnectionCards } from '@/lib/actions/handshakes'
import { getComputedMatchesForPartnership } from '@/lib/actions/computedMatches'
import { ProfilePhotosSection } from '@/components/dashboard/ProfilePhotosSection'
import { GenerateSummaryButton } from '@/components/dashboard/GenerateSummaryButton'
import { getFallbackInsight } from '@/lib/ai/fallbacks'

export const dynamic = 'force-dynamic'

/**
 * Detect whether a stored haevn_insight is the deterministic
 * "we don't have enough yet" fallback string from lib/ai/fallbacks.ts.
 *
 * The DB can end up holding the fallback when generation ran without an
 * AI key set (e.g. Anthropic before the OpenAI swap, or an envless
 * preview deploy). We treat fallback content as "no real summary yet"
 * so the user gets the Generate CTA instead of the placeholder text.
 */
function isFallbackInsight(text: string | null | undefined): boolean {
  if (!text) return false
  return text.trim() === getFallbackInsight().trim()
}

interface PartnershipPhotoRow {
  id: string
  photo_url: string
  photo_type: 'public' | 'private'
  is_primary: boolean
  order_index: number
}

/**
 * Server-side photo fetch via admin client (browser client RLS-rejects
 * in server components — see prior commit).
 */
async function loadPartnershipPhotos(
  partnershipId: string
): Promise<PartnershipPhotoRow[]> {
  try {
    const adminClient = await createAdminClient()
    const { data, error } = await adminClient
      .from('partnership_photos')
      .select('id, photo_url, photo_type, is_primary, order_index')
      .eq('partnership_id', partnershipId)
      .order('order_index', { ascending: true })
    if (error) {
      console.error('[ProfilePage] photos query error:', error.message)
      return []
    }
    return (data || []) as PartnershipPhotoRow[]
  } catch (err) {
    console.error('[ProfilePage] photos query threw:', err)
    return []
  }
}

/**
 * Inline admin query for profile-only fields the dashboard loader
 * doesn't already return: partnerships.city, partnerships.is_verified,
 * and the user's birthdate from user_survey_responses (Q1).
 */
async function loadProfileExtras(
  userId: string,
  partnershipId: string | undefined
): Promise<{ city?: string; age?: number; isVerified: boolean }> {
  if (!partnershipId) return { isVerified: false }
  try {
    const adminClient = await createAdminClient()
    const [partnershipQ, surveyQ] = await Promise.all([
      adminClient
        .from('partnerships')
        .select('city, is_verified')
        .eq('id', partnershipId)
        .single(),
      adminClient
        .from('user_survey_responses')
        .select('answers_json')
        .eq('user_id', userId)
        .maybeSingle(),
    ])
    const city = (partnershipQ.data as any)?.city || undefined
    const isVerified = (partnershipQ.data as any)?.is_verified === true
    const age = computeAge((surveyQ.data as any)?.answers_json?.q1_age)
    return { city, age, isVerified }
  } catch (err) {
    console.error('[ProfilePage] profile extras query threw:', err)
    return { isVerified: false }
  }
}

/** Accepts either an ISO date string or { year, month, day }. */
function computeAge(raw: unknown): number | undefined {
  if (!raw) return undefined
  let y: number | undefined
  let m: number | undefined
  let d: number | undefined
  if (typeof raw === 'string') {
    const dt = new Date(raw)
    if (!Number.isNaN(dt.getTime())) {
      y = dt.getUTCFullYear()
      m = dt.getUTCMonth() + 1
      d = dt.getUTCDate()
    }
  } else if (typeof raw === 'object' && raw !== null) {
    const o = raw as { year?: number; month?: number; day?: number }
    y = o.year
    m = o.month
    d = o.day
  }
  if (!y) return undefined
  const today = new Date()
  let age = today.getUTCFullYear() - y
  if (m && d) {
    const monthDelta = today.getUTCMonth() + 1 - m
    if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < d)) {
      age -= 1
    }
  }
  if (age < 0 || age > 130) return undefined
  return age
}

function formatMemberSince(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `Member since ${d.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  })}`
}

export default async function ProfilePage() {
  const data = await loadDashboardData()
  if (!data) redirect('/auth/login')

  const { user, profile, partnership } = data
  const displayName = profile?.fullName || 'HAEVN Member'
  const memberSince = formatMemberSince((user as any).created_at)

  const [photosRaw, connectionCards, computedMatches, extras] = await Promise.all([
    partnership?.id
      ? loadPartnershipPhotos(partnership.id)
      : Promise.resolve([] as PartnershipPhotoRow[]),
    getConnectionCards().catch(() => []),
    partnership?.id
      ? getComputedMatchesForPartnership(partnership.id).catch(() => ({
          matches: [] as any[],
          error: null,
        }))
      : Promise.resolve({ matches: [] as any[], error: null }),
    loadProfileExtras(user.id, partnership?.id),
  ])

  const publicPhotos = photosRaw
    .filter(p => p.photo_type === 'public')
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1
      if (!a.is_primary && b.is_primary) return 1
      return a.order_index - b.order_index
    })
    .map(p => ({
      id: p.id,
      photo_url: p.photo_url,
      is_primary: p.is_primary,
    }))

  const primaryPhoto = publicPhotos[0]?.photo_url ?? profile?.photoUrl

  const matchCount = computedMatches.matches.length
  const connectionCount = connectionCards.length
  const isFree = partnership?.tier !== 'plus'
  const tierLabel = isFree ? 'Free' : 'HAEVN+'
  const haevnInsight = partnership?.haevnInsight

  console.log('[PROFILE_PAGE_STATE]', {
    userId: user.id,
    partnershipId: partnership?.id,
    tierRaw: partnership?.tier,
    haevnInsightPresent: !!haevnInsight,
    haevnInsightLength: haevnInsight?.length ?? 0,
    publicPhotoCount: publicPhotos.length,
    matchCount,
    connectionCount,
    age: extras.age,
    city: extras.city,
    isVerified: extras.isVerified,
  })

  const subtitleParts = [extras.city, memberSince].filter(Boolean)

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* ─── HERO PROFILE HEADER ─── */}
      <div className="bg-white border border-[color:var(--haevn-border)] overflow-hidden">
        {/* Cover (primary photo) — clickable to /profile/edit */}
        {primaryPhoto ? (
          <Link
            href="/profile/edit"
            className="relative block h-72 sm:h-96 md:h-[28rem] bg-gradient-to-br from-[#F9F5EB] to-[#E8E6E3] overflow-hidden group"
          >
            <img
              src={primaryPhoto}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover"
              style={{ objectPosition: 'center 20%' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
          </Link>
        ) : (
          <div className="relative h-72 sm:h-96 md:h-[28rem] flex flex-col items-center justify-center bg-gradient-to-br from-[#F9F5EB] to-[#E8E6E3]">
            <Camera
              className="w-8 h-8 text-[color:var(--haevn-muted-fg)] mb-2"
              strokeWidth={1.5}
            />
            <p className="text-sm text-[color:var(--haevn-muted-fg)]">
              Add a primary photo
            </p>
          </div>
        )}

        {/* Profile info */}
        <div className="relative px-6 pb-6">
          {/* Avatar overlapping the cover, left-aligned */}
          <div className="-mt-20 mb-4 relative z-10">
            <div className="w-32 h-32 sm:w-40 sm:h-40 keep-rounded border-4 border-white bg-[#F9F5EB] overflow-hidden shadow-sm">
              {primaryPhoto ? (
                <img
                  src={primaryPhoto}
                  alt={displayName}
                  className="w-full h-full object-cover keep-rounded"
                  style={{ objectPosition: 'center 20%' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-heading text-4xl text-[color:var(--haevn-gold)]">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          <h1 className="font-heading text-2xl text-[color:var(--haevn-navy)]">
            {displayName}
            {extras.age ? `, ${extras.age}` : ''}
          </h1>
          {subtitleParts.length > 0 && (
            <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
              {subtitleParts.join(' · ')}
            </p>
          )}

          {/* Stats inline */}
          <div className="flex gap-6 mt-4">
            <Link
              href="/dashboard/matches"
              className="block transition-opacity hover:opacity-80"
            >
              <span className="font-heading text-xl text-[color:var(--haevn-navy)] tabular-nums">
                {matchCount}
              </span>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--haevn-muted-fg)] mt-0.5">
                Matches
              </p>
            </Link>
            <Link
              href="/dashboard/connections"
              className="block transition-opacity hover:opacity-80"
            >
              <span className="font-heading text-xl text-[color:var(--haevn-teal)] tabular-nums">
                {connectionCount}
              </span>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--haevn-muted-fg)] mt-0.5">
                Connection{connectionCount === 1 ? '' : 's'}
              </p>
            </Link>
            <div>
              <span className="text-sm font-medium text-[color:var(--haevn-muted-fg)]">
                {tierLabel}
              </span>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[color:var(--haevn-muted-fg)] mt-0.5">
                Plan
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── AI SUMMARY ─── */}
      <div className="bg-white border border-[color:var(--haevn-border)] p-5 sm:p-6">
        <h3 className="font-heading text-lg text-[color:var(--haevn-navy)] mb-1">
          Your Profile Summary
        </h3>
        <p className="text-[11px] tracking-[0.18em] uppercase text-[color:var(--haevn-navy)]/60 mb-4">
          What HAEVN understands about you
        </p>
        {(() => {
          const insightIsRealContent =
            !!haevnInsight && !isFallbackInsight(haevnInsight)

          if (insightIsRealContent) {
            return (
              <div className="space-y-3">
                <p className="text-[15px] text-[color:var(--haevn-charcoal)] leading-relaxed whitespace-pre-line">
                  {haevnInsight}
                </p>
                {partnership?.id && (
                  <GenerateSummaryButton
                    partnershipId={partnership.id}
                    variant="subtle"
                  />
                )}
              </div>
            )
          }

          if (partnership?.id) {
            return (
              <div>
                <p className="text-[15px] text-[color:var(--haevn-muted-fg)] leading-relaxed">
                  Generate your profile summary to see how HAEVN reads your
                  survey answers. We use it to introduce you to potential
                  matches.
                </p>
                <GenerateSummaryButton partnershipId={partnership.id} />
              </div>
            )
          }

          return (
            <p className="text-[15px] text-[color:var(--haevn-muted-fg)] leading-relaxed">
              Your profile summary will appear here once your survey responses
              have been processed.{' '}
              <Link
                href="/onboarding/survey"
                className="text-[color:var(--haevn-teal)] underline underline-offset-2 hover:opacity-80"
              >
                Complete your survey
              </Link>{' '}
              to generate it.
            </p>
          )
        })()}
      </div>

      {/* ─── PHOTOS ACCORDION ─── */}
      <ProfilePhotosSection photos={publicPhotos} />

      {/* ─── ACCOUNT ─── */}
      <div className="bg-white border border-[color:var(--haevn-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[color:var(--haevn-border)]">
          <h3 className="font-heading text-lg text-[color:var(--haevn-navy)]">
            Account
          </h3>
        </div>
        <AccountRow
          icon={UserIcon}
          label="Display Name"
          value={displayName}
          href="/account-details"
        />
        <AccountRow
          icon={Mail}
          label="Email Address"
          value={user.email}
          href="/account-details"
        />
        <AccountRow
          icon={Lock}
          label="Password"
          action="Reset"
          href="/auth/reset-password"
        />
        <VerificationRow isVerified={extras.isVerified} isLast />
      </div>

      {/* ─── PLAN & BILLING ─── */}
      <div className="bg-white border border-[color:var(--haevn-border)] p-5 sm:p-6">
        <h3 className="font-heading text-lg text-[color:var(--haevn-navy)] mb-4">
          Plan &amp; Billing
        </h3>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-[color:var(--haevn-navy)] font-medium">
              {isFree ? 'Free Plan' : 'HAEVN+ Member'}
            </p>
            <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-0.5">
              {isFree
                ? 'Upgrade to unlock photos, connect, and message'
                : 'Active membership · Manage from billing'}
            </p>
          </div>
          <span
            className={
              isFree
                ? 'text-xs px-3 py-1 text-[color:var(--haevn-muted-fg)] bg-[color:var(--haevn-dash-surface-alt)]'
                : 'text-xs px-3 py-1 text-[color:var(--haevn-gold)] bg-[rgba(226,158,12,0.08)] border border-[rgba(226,158,12,0.2)]'
            }
          >
            {isFree ? 'Free' : 'Active'}
          </span>
        </div>
        {isFree ? (
          <Link
            href="/onboarding/membership"
            className="haevn-btn-gold w-full inline-flex justify-center"
          >
            Upgrade to HAEVN+
          </Link>
        ) : (
          <Link
            href="/account-details"
            className="text-sm text-[color:var(--haevn-muted-fg)] hover:text-[color:var(--haevn-navy)] transition-colors"
          >
            Manage billing
          </Link>
        )}
      </div>

      {/* ─── PREFERENCES ─── */}
      <div className="bg-white border border-[color:var(--haevn-border)] overflow-hidden">
        <div className="px-6 py-4 border-b border-[color:var(--haevn-border)]">
          <h3 className="font-heading text-lg text-[color:var(--haevn-navy)]">
            Preferences
          </h3>
        </div>
        <NavRow
          label="Notifications"
          desc="Match Monday alerts, messages"
          href="/settings"
        />
        <NavRow
          label="Privacy"
          desc="Profile visibility, data sharing"
          href="/settings"
        />
        <NavRow
          label="Matching Preferences"
          desc="Update your survey responses"
          href="/survey-results"
          isLast
        />
      </div>

      {/* ─── DANGER ZONE ─── */}
      <div className="bg-white border border-red-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-50">
          <h3 className="text-sm font-medium text-red-400 tracking-[0.14em] uppercase">
            Danger Zone
          </h3>
        </div>
        <DangerRow
          label="Pause Account"
          desc="Temporarily hide your profile from matches"
          tone="muted"
          icon="chevron"
        />
        <DangerRow
          label="Cancel Account"
          desc="Permanently delete your account and data"
          tone="danger"
          icon="warning"
          isLast
        />
      </div>

      <div className="h-12 md:h-0" />
    </div>
  )
}

// ---------- helpers ---------- //

function AccountRow({
  icon: Icon,
  label,
  value,
  action,
  badgeText,
  href,
  isLast = false,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
  label: string
  value?: React.ReactNode
  action?: string
  badgeText?: string
  href: string
  isLast?: boolean
}) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors ${
        isLast ? '' : 'border-b border-[color:var(--haevn-border)]'
      }`}
    >
      <div className="w-9 h-9 bg-[color:var(--haevn-dash-surface-alt)] flex items-center justify-center shrink-0">
        <Icon
          className="w-4 h-4 text-[color:var(--haevn-muted-fg)]"
          strokeWidth={1.5}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[color:var(--haevn-navy)]">{label}</p>
        {value !== undefined && (
          <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5 truncate">
            {value}
          </p>
        )}
      </div>
      {badgeText && (
        <span className="text-[10px] tracking-[0.14em] uppercase text-[color:var(--haevn-teal)] bg-[rgba(0,128,128,0.08)] px-2 py-0.5 shrink-0">
          {badgeText}
        </span>
      )}
      {action && (
        <span className="text-xs text-[color:var(--haevn-gold)] shrink-0">
          {action}
        </span>
      )}
      {!badgeText && !action && (
        <ChevronRight
          className="w-4 h-4 text-[color:var(--haevn-muted-fg)] shrink-0"
          strokeWidth={1.5}
        />
      )}
    </Link>
  )
}

function VerificationRow({
  isVerified,
  isLast = false,
}: {
  isVerified: boolean
  isLast?: boolean
}) {
  // Verified state: same shape as a static AccountRow but with the
  // green VERIFIED pill and a chevron pointing back to /account-details.
  if (isVerified) {
    return (
      <Link
        href="/account-details"
        className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors ${
          isLast ? '' : 'border-b border-[color:var(--haevn-border)]'
        }`}
      >
        <div className="w-9 h-9 bg-[rgba(0,128,128,0.08)] flex items-center justify-center shrink-0">
          <Shield
            className="w-4 h-4 text-[color:var(--haevn-teal)]"
            strokeWidth={1.5}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[color:var(--haevn-navy)]">Verification</p>
          <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5">
            Verified
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] tracking-[0.14em] uppercase text-white bg-[color:var(--haevn-teal)] px-2 py-1 shrink-0">
          <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
          Verified
        </span>
      </Link>
    )
  }

  // Unverified state: gray shield + Verify CTA -> /onboarding/verification
  return (
    <Link
      href="/onboarding/verification"
      className={`w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors ${
        isLast ? '' : 'border-b border-[color:var(--haevn-border)]'
      }`}
    >
      <div className="w-9 h-9 bg-[color:var(--haevn-dash-surface-alt)] flex items-center justify-center shrink-0">
        <Shield
          className="w-4 h-4 text-[color:var(--haevn-muted-fg)]"
          strokeWidth={1.5}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[color:var(--haevn-navy)]">Verification</p>
        <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5">
          Confirm your identity
        </p>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-[color:var(--haevn-teal)] shrink-0">
        Verify
        <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
      </span>
    </Link>
  )
}

function NavRow({
  label,
  desc,
  href,
  isLast = false,
}: {
  label: string
  desc: string
  href: string
  isLast?: boolean
}) {
  return (
    <Link
      href={href}
      className={`w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors ${
        isLast ? '' : 'border-b border-[color:var(--haevn-border)]'
      }`}
    >
      <div className="min-w-0">
        <span className="text-sm text-[color:var(--haevn-charcoal)] block">
          {label}
        </span>
        <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5">
          {desc}
        </p>
      </div>
      <ChevronRight
        className="w-4 h-4 text-[color:var(--haevn-muted-fg)] shrink-0"
        strokeWidth={1.5}
      />
    </Link>
  )
}

function DangerRow({
  label,
  desc,
  tone,
  icon,
  isLast = false,
}: {
  label: string
  desc: string
  tone: 'muted' | 'danger'
  icon: 'chevron' | 'warning'
  isLast?: boolean
}) {
  return (
    <button
      type="button"
      // No-op for now — feature is a placeholder per spec. Hooks up later.
      className={`w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-red-50/50 transition-colors ${
        isLast ? '' : 'border-b border-[color:var(--haevn-border)]'
      }`}
    >
      <div>
        <span
          className={`text-sm block ${
            tone === 'danger'
              ? 'text-red-400'
              : 'text-[color:var(--haevn-charcoal)]'
          }`}
        >
          {label}
        </span>
        <p className="text-[13px] text-[color:var(--haevn-muted-fg)] mt-0.5">
          {desc}
        </p>
      </div>
      {icon === 'warning' ? (
        <AlertTriangle
          className="w-4 h-4 text-red-300 shrink-0"
          strokeWidth={1.5}
        />
      ) : (
        <ChevronRight
          className="w-4 h-4 text-[color:var(--haevn-muted-fg)] shrink-0"
          strokeWidth={1.5}
        />
      )}
    </button>
  )
}
