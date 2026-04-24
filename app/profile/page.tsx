import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Bell,
  ShieldCheck,
  Mail,
  User as UserIcon,
  Lock,
  CheckCircle2,
  ChevronRight,
  Camera,
  Sparkles,
} from 'lucide-react'
import { loadDashboardData } from '@/lib/dashboard/loadDashboardData'
import { getPartnershipPhotos } from '@/lib/services/photos'
import { getConnectionCards } from '@/lib/actions/handshakes'
import { getComputedMatchesForPartnership } from '@/lib/actions/computedMatches'
import { ProfilePhotosSection } from '@/components/dashboard/ProfilePhotosSection'

export const dynamic = 'force-dynamic'

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

  // Parallel secondary queries — independent of loadDashboardData
  const [photosRaw, connectionCards, computedMatches] = await Promise.all([
    partnership?.id
      ? getPartnershipPhotos(partnership.id).catch(() => [])
      : Promise.resolve([]),
    getConnectionCards().catch(() => []),
    partnership?.id
      ? getComputedMatchesForPartnership(partnership.id).catch(() => ({
          matches: [] as any[],
          error: null,
        }))
      : Promise.resolve({ matches: [] as any[], error: null }),
  ])

  const publicPhotos = (photosRaw || [])
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

  const primaryPhoto = publicPhotos[0]?.photo_url

  const matchCount = computedMatches.matches.length
  const connectionCount = connectionCards.length
  const tier = partnership?.tier === 'plus' ? 'HAEVN+' : 'Free'
  const isFree = partnership?.tier !== 'plus'
  const haevnInsight = partnership?.haevnInsight

  return (
    <div className="w-full">
      {/* Section A — Cover + avatar */}
      <section className="relative">
        <div
          className="w-full h-40 sm:h-56"
          style={{
            background:
              'linear-gradient(135deg, var(--haevn-navy) 0%, #2D3E66 60%, var(--haevn-teal) 100%)',
          }}
        />
        <div className="max-w-3xl mx-auto px-5 sm:px-10 -mt-16 sm:-mt-20 flex items-end gap-4">
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 keep-rounded shrink-0 border-4 border-[color:var(--haevn-dash-bg)] overflow-hidden bg-[color:var(--haevn-dash-surface-alt)]">
            {primaryPhoto ? (
              <img
                src={primaryPhoto}
                alt={displayName}
                className="w-full h-full object-cover keep-rounded"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <UserIcon
                  className="w-10 h-10 text-[color:var(--haevn-muted-fg)]"
                  strokeWidth={1.25}
                />
              </div>
            )}
            <Link
              href="/profile/edit"
              className="absolute bottom-1 right-1 w-8 h-8 keep-rounded bg-[color:var(--haevn-navy)] text-white flex items-center justify-center hover:bg-[color:var(--haevn-teal)] transition-colors"
              aria-label="Change photo"
            >
              <Camera className="w-4 h-4" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>

      {/* Section B — Identity + stats */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pt-5 pb-8">
        <h1 className="font-heading text-3xl sm:text-4xl text-[color:var(--haevn-navy)] leading-tight">
          {displayName}
        </h1>
        {memberSince && (
          <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
            {memberSince}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-8 pt-6 border-t border-[color:var(--haevn-border)]">
          <Stat value={matchCount} label="Matches" />
          <Stat value={connectionCount} label="Connections" tint="teal" />
          <Stat textValue={tier} label="Plan" />
        </div>
      </section>

      {/* Section C — Profile Summary */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pb-8">
        <div className="bg-white border border-[color:var(--haevn-border)] p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles
              className="w-4 h-4 text-[color:var(--haevn-teal)]"
              strokeWidth={1.75}
            />
            <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-teal)]">
              What HAEVN understands about you
            </p>
          </div>
          <h2 className="font-heading text-xl text-[color:var(--haevn-navy)] mb-3">
            Your profile summary
          </h2>
          {haevnInsight ? (
            <p className="text-base text-[color:var(--haevn-charcoal)] leading-relaxed">
              {haevnInsight}
            </p>
          ) : (
            <p className="text-base text-[color:var(--haevn-muted-fg)] leading-relaxed">
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
          )}
        </div>
      </section>

      {/* Section D — Photos */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pb-8">
        <ProfilePhotosSection photos={publicPhotos} />
      </section>

      {/* Section E — Account */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pb-8">
        <div className="bg-white border border-[color:var(--haevn-border)]">
          <SectionHeading>Account</SectionHeading>
          <AccountRow
            icon={<UserIcon className="w-4 h-4" strokeWidth={1.5} />}
            label="Display name"
            value={displayName}
            href="/account-details"
          />
          <AccountRow
            icon={<Mail className="w-4 h-4" strokeWidth={1.5} />}
            label="Email"
            value={user.email}
            href="/account-details"
          />
          <AccountRow
            icon={<Lock className="w-4 h-4" strokeWidth={1.5} />}
            label="Password"
            value="Reset"
            href="/auth/reset-password"
            valueTint="teal"
          />
          <AccountRow
            icon={
              <ShieldCheck
                className="w-4 h-4 text-[color:var(--haevn-teal)]"
                strokeWidth={1.5}
              />
            }
            label="Verification"
            value={
              <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.14em] uppercase text-white bg-[color:var(--haevn-teal)] px-2 py-1">
                <CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />
                Verified
              </span>
            }
            href="/account-details"
            isLast
          />
        </div>
      </section>

      {/* Section F — Plan & Billing */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pb-8">
        <div className="bg-white border border-[color:var(--haevn-border)] p-5 sm:p-6">
          <SectionHeading inline>Plan &amp; billing</SectionHeading>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-xl text-[color:var(--haevn-navy)]">
                  {tier} plan
                </span>
                {!isFree && (
                  <span className="text-[10px] tracking-[0.14em] uppercase text-white bg-[color:var(--haevn-gold)] px-2 py-0.5">
                    Active
                  </span>
                )}
              </div>
              {isFree && (
                <p className="mt-1 text-sm text-[color:var(--haevn-muted-fg)]">
                  Upgrade to unlock photos, connect, and message.
                </p>
              )}
            </div>
          </div>
          {isFree && (
            <Link
              href="/onboarding/membership"
              className="haevn-btn-gold w-full mt-5 inline-flex justify-center"
            >
              Upgrade to HAEVN+
            </Link>
          )}
        </div>
      </section>

      {/* Section G — Preferences */}
      <section className="max-w-3xl mx-auto px-5 sm:px-10 pb-16">
        <div className="bg-white border border-[color:var(--haevn-border)]">
          <SectionHeading>Preferences</SectionHeading>
          <AccountRow
            icon={<Bell className="w-4 h-4" strokeWidth={1.5} />}
            label="Notifications"
            sublabel="Emails, SMS, in-app"
            href="/settings"
          />
          <AccountRow
            icon={<ShieldCheck className="w-4 h-4" strokeWidth={1.5} />}
            label="Privacy"
            sublabel="Who can see your profile"
            href="/settings"
            isLast
          />
        </div>
      </section>
    </div>
  )
}

// ---------- tiny helpers rendered as server component markup ---------- //

function Stat({
  value,
  textValue,
  label,
  tint = 'navy',
}: {
  value?: number
  textValue?: string
  label: string
  tint?: 'navy' | 'teal'
}) {
  const color =
    tint === 'teal'
      ? 'text-[color:var(--haevn-teal)]'
      : 'text-[color:var(--haevn-navy)]'
  return (
    <div>
      <div className={`font-heading text-3xl sm:text-4xl tabular-nums ${color}`}>
        {textValue ?? value}
      </div>
      <p className="mt-1 text-[11px] tracking-[0.18em] uppercase text-[color:var(--haevn-muted-fg)]">
        {label}
      </p>
    </div>
  )
}

function SectionHeading({
  children,
  inline = false,
}: {
  children: React.ReactNode
  inline?: boolean
}) {
  return (
    <div
      className={`${inline ? 'mb-4' : 'px-5 sm:px-6 pt-5 pb-3 border-b border-[color:var(--haevn-border)]'}`}
    >
      <p className="text-[11px] tracking-[0.22em] uppercase text-[color:var(--haevn-muted-fg)]">
        {children}
      </p>
    </div>
  )
}

function AccountRow({
  icon,
  label,
  sublabel,
  value,
  href,
  valueTint,
  isLast = false,
}: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  value?: React.ReactNode
  href: string
  valueTint?: 'teal'
  isLast?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-5 sm:px-6 py-4 text-left hover:bg-[color:var(--haevn-dash-surface-alt)] transition-colors ${
        isLast ? '' : 'border-b border-[color:var(--haevn-border)]'
      }`}
    >
      <span className="w-8 h-8 flex items-center justify-center text-[color:var(--haevn-muted-fg)] shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[color:var(--haevn-navy)]">{label}</p>
        {sublabel && (
          <p className="text-xs text-[color:var(--haevn-muted-fg)] mt-0.5">
            {sublabel}
          </p>
        )}
      </div>
      {value !== undefined && (
        <span
          className={`text-sm max-w-[50%] truncate ${
            valueTint === 'teal'
              ? 'text-[color:var(--haevn-teal)]'
              : 'text-[color:var(--haevn-muted-fg)]'
          }`}
        >
          {value}
        </span>
      )}
      <ChevronRight
        className="w-4 h-4 text-[color:var(--haevn-muted-fg)] shrink-0"
        strokeWidth={1.5}
      />
    </Link>
  )
}
