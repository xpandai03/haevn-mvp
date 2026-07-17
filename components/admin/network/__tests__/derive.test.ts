/**
 * WoW / sparkline / graceful-degradation logic for the dashboard cards.
 * Run: npx tsx components/admin/network/__tests__/derive.test.ts
 * Pure — synthetic payloads, no DB. Covers the launch states (0/1/2 snapshots,
 * past-week selection) from acceptance #3 and #6.
 */
import { snapshotMetric, weeklyMetric } from '../derive'
import type { NetworkMetricsPayload } from '../types'
import { eq, report } from '../../../../lib/metrics/__tests__/_assert'

// Minimal payload factory. weekEndings are arbitrary but internally consistent.
function makePayload(opts: {
  totalMembers?: number
  matchesGenerated?: number
  isCurrent?: boolean
  selWeek?: string
  priorWeek?: string
  history?: Array<{ date: string; total: number; matches: number }>
}): NetworkMetricsPayload {
  const {
    totalMembers = 600,
    matchesGenerated = 10,
    isCurrent = true,
    selWeek = '2026-07-18',
    priorWeek = '2026-07-11',
    history = [],
  } = opts
  return {
    scopeLabel: 'network',
    currentWeekEnding: '2026-07-18',
    currentPriorWeekEnding: '2026-07-11',
    selectedWeek: {
      weekEnding: selWeek,
      start: '',
      end: '',
      label: '',
      priorWeekEnding: priorWeek,
      priorLabel: '',
      isCurrent,
    },
    metrics: {
      scope: 'network',
      scopeLabel: 'network',
      week: { weekEnding: selWeek, start: '', end: '' },
      partnershipsInScope: totalMembers,
      snapshot: {
        totalMembers,
        incompleteSurveys: 0,
        completedSurveys: 0,
        membersFree: 0,
        noCurrentMatch: 0,
        plusMembers: { blocked: true, reason: '' },
        plusConversion: { blocked: true, reason: '' },
        meetupShares: { blocked: true, reason: '' },
      },
      weekly: {
        matchesGenerated,
        recommendationsGenerated: 0,
        nudgesSent: 0,
        readyToMeetSignals: 0,
        newConnections: 0,
        conversationsStarted: 0,
      },
      generatedAt: '',
    },
    composition: { gender: [], orientation: [], relationshipIntent: [], age: [] },
    surveyedInScope: 0,
    history: history.map((h) => ({
      snapshot_date: h.date,
      market_name: null,
      metrics: {
        scopeLabel: 'network',
        weekEnding: h.date,
        partnershipsInScope: h.total,
        snapshot: {
          totalMembers: h.total,
          incompleteSurveys: 0,
          completedSurveys: 0,
          membersFree: 0,
          noCurrentMatch: 0,
          plusMembers: { blocked: true, reason: '' },
          plusConversion: { blocked: true, reason: '' },
          meetupShares: { blocked: true, reason: '' },
        },
        weekly: {
          matchesGenerated: h.matches,
          recommendationsGenerated: 0,
          nudgesSent: 0,
          readyToMeetSignals: 0,
          newConnections: 0,
          conversationsStarted: 0,
        },
        composition: { gender: [], orientation: [], relationshipIntent: [], age: [] },
        generatedAt: '',
      },
    })),
  }
}

// ── Zero snapshots (fresh deploy) ────────────────────────────────────────────
{
  const p = makePayload({ totalMembers: 597, matchesGenerated: 10, history: [] })
  const s = snapshotMetric(p, 'totalMembers')
  eq(s.value, 597, 'zero-snap: snapshot value = live')
  eq(s.prior, null, 'zero-snap: no prior → null (collecting history)')
  eq(s.series, [597], 'zero-snap: series is single live point (flat dot)')

  const w = weeklyMetric(p, 'matchesGenerated')
  eq(w.value, 10, 'zero-snap: weekly value = live')
  eq(w.prior, null, 'zero-snap: weekly no prior → null')
  eq(w.series, [10], 'zero-snap: weekly series single point')
}

// ── One snapshot, for the prior week ─────────────────────────────────────────
{
  const p = makePayload({
    totalMembers: 597,
    matchesGenerated: 10,
    history: [{ date: '2026-07-11', total: 580, matches: 8 }],
  })
  const s = snapshotMetric(p, 'totalMembers')
  eq(s.prior, 580, 'one-snap: snapshot prior read from prior-week row')
  eq(s.series, [580, 597], 'one-snap: series = [prior, live]')

  const w = weeklyMetric(p, 'matchesGenerated')
  eq(w.prior, 8, 'one-snap: weekly prior from prior-week row')
  eq(w.series, [8, 10], 'one-snap: weekly series = [prior, live]')
}

// ── Two snapshots ────────────────────────────────────────────────────────────
{
  const p = makePayload({
    totalMembers: 610,
    history: [
      { date: '2026-07-04', total: 560, matches: 5 },
      { date: '2026-07-11', total: 580, matches: 8 },
    ],
  })
  const s = snapshotMetric(p, 'totalMembers')
  eq(s.prior, 580, 'two-snap: prior = most-recent prior week (07-11)')
  eq(s.series, [560, 580, 610], 'two-snap: series = both history + live')
}

// ── Live snapshot already stored for current week (no double-append) ─────────
{
  const p = makePayload({
    totalMembers: 597,
    history: [{ date: '2026-07-18', total: 597, matches: 10 }], // current week already snapshotted
  })
  const s = snapshotMetric(p, 'totalMembers')
  eq(s.series, [597], 'current-week snapshot present → live not double-appended')
  eq(s.prior, null, 'no prior-week row → prior null even though this-week row exists')
}

// ── Past week selected: value comes from that week's snapshot, not live ───────
{
  const p = makePayload({
    matchesGenerated: 99, // live (would be wrong for a past week)
    isCurrent: false,
    selWeek: '2026-07-11',
    priorWeek: '2026-07-04',
    history: [
      { date: '2026-07-04', total: 560, matches: 5 },
      { date: '2026-07-11', total: 580, matches: 8 },
    ],
  })
  const w = weeklyMetric(p, 'matchesGenerated')
  eq(w.value, 8, 'past-week: weekly value from that week snapshot (not live 99)')
  eq(w.prior, 5, 'past-week: prior from the week before')
}

// ── Past week selected with NO snapshot → null (no activity for this week) ────
{
  const p = makePayload({
    isCurrent: false,
    selWeek: '2026-06-27',
    priorWeek: '2026-06-20',
    history: [],
  })
  const w = weeklyMetric(p, 'matchesGenerated')
  eq(w.value, null, 'past-week without snapshot → null (renders "no activity")')
}

report('derive')
