'use client'

/**
 * Engagement strip — the client's "can we tell if anybody's logged in?" answer.
 * Un-numbered section between Weekly Activity (2) and Composition (3), so the
 * existing numbered sections and their 8/6 grids are untouched.
 */

import { Activity, Bell, LogIn, Users2 } from 'lucide-react'
import type { NetworkMetricsPayload } from './types'
import type { RenotifyStatus } from '@/lib/metrics/types'
import { engagementMetric } from './derive'
import { KpiCard } from './cards'
import { InfoTip } from './primitives'

const TEAL = '#008080'
const GREEN = '#388E3C'
const ORANGE = '#E29E0C'

export function EngagementStrip({ data }: { data: NetworkMetricsPayload }) {
  const eng = data.metrics.engagement
  const loggedIn = engagementMetric(data, 'loggedInEverPartnerships')
  const active = engagementMetric(data, 'activeThisWeekPartnerships')

  const loggedInTooltip =
    `Partnerships where at least one member has ever signed in — of ` +
    `${eng.totalPartnerships.toLocaleString()} total. ${eng.loggedInEverPeople.toLocaleString()} people ` +
    `have signed in. (Members are counted as partnerships.)`

  const activeTooltip =
    `Partnerships with a member who signed in during this reporting week. ` +
    `Only computable live for the CURRENT week — last_sign_in_at holds the latest ` +
    `sign-in only, so past weeks come from weekly snapshots.`

  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-haevn-navy text-white">
          <Users2 className="h-3.5 w-3.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Engagement</h2>
          <p className="mt-0.5 text-xs text-gray-400">Are members entering the app?</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Logged In Ever"
          value={loggedIn.value}
          prior={loggedIn.prior}
          series={loggedIn.series}
          icon={LogIn}
          accent={TEAL}
          tooltip={loggedInTooltip}
          footnote={`${eng.loggedInEverPeople.toLocaleString()} people · of ${eng.totalPartnerships.toLocaleString()} partnerships`}
        />
        <KpiCard
          label="Active This Week"
          value={active.value}
          prior={active.prior}
          series={active.series}
          icon={Activity}
          accent={GREEN}
          tooltip={activeTooltip}
          unavailableNote="Available from weekly snapshots (past weeks aren't computable live)."
        />
        <div className="lg:col-span-2">
          <ReNotifyCard status={data.renotifyStatus} />
        </div>
      </div>
    </section>
  )
}

function ReNotifyCard({ status }: { status: RenotifyStatus | null }) {
  const tooltip =
    'The most recent re-notification run: eligible partnerships, sends by channel, and ' +
    'suppressions (login / cap). Dry runs record intent but send nothing.'

  return (
    <div className="flex h-full flex-col rounded-xl border bg-white px-5 py-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${ORANGE}1A`, color: ORANGE }}
        >
          <Bell className="h-4 w-4" />
        </span>
        <p className="text-xs uppercase tracking-wide text-gray-400">Re-notification</p>
        <InfoTip text={tooltip} />
        <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-300">network-wide</span>
      </div>

      {!status ? (
        <div className="flex flex-1 flex-col justify-center">
          <p className="text-sm font-semibold text-gray-700">No runs recorded yet</p>
          <p className="mt-0.5 text-[11px] text-gray-400">
            The engine ships disabled (dry-run). It logs a run each Monday once enabled.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-800">Last run: {status.runDate}</p>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                status.dryRun
                  ? 'bg-haevn-orange/15 text-haevn-orange'
                  : 'bg-haevn-success/15 text-haevn-success'
              }`}
            >
              {status.dryRun ? 'dry run' : 'live'}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
            <span><span className="font-semibold tabular-nums text-gray-900">{status.total}</span> eligible</span>
            <span><span className="font-semibold tabular-nums text-gray-900">{status.sent.sms + status.sent.email}</span> sent <span className="text-gray-400">({status.sent.sms} sms · {status.sent.email} email)</span></span>
            <span><span className="font-semibold tabular-nums text-gray-900">{status.suppressed.login_detected}</span> logged-in</span>
            <span><span className="font-semibold tabular-nums text-gray-900">{status.suppressed.cap_reached}</span> capped</span>
            {status.failures > 0 && (
              <span className="text-haevn-error"><span className="font-semibold tabular-nums">{status.failures}</span> failed</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
