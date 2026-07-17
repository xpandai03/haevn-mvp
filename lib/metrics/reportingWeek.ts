/**
 * Reporting-week model — the SINGLE source of week logic for the Network
 * dashboard. Every other metrics module imports week boundaries from here; no
 * inline date math anywhere else.
 *
 * WEEK SHAPE: Sunday 00:00:00.000 → Saturday 23:59:59.999 (Rik's spec header).
 * `snapshot_date` is the week-ending Saturday.
 *
 * TIMEZONE: UTC. The spec text said America/Chicago, but it also instructed us
 * to confirm and MATCH the app's existing handling ("consistency beats
 * correctness"). The entire app does date math in UTC — `getNextMondayUTC`
 * (app/api/admin/system-status/route.ts), `getNextMonday`
 * (lib/services/computeMatches.ts), and every cron schedule are UTC, and no
 * timezone library is installed. So reporting weeks are UTC. If product later
 * needs Austin-local weeks, that is a follow-up that must also move the existing
 * crons; flagged in the PR.
 */

/** The day the reporting week starts on. 0 = Sunday (Sun–Sat weeks). */
export const WEEK_START_DAY = 0

export interface ReportingWeek {
  /** Sunday 00:00:00.000 UTC, inclusive. */
  start: Date
  /** Saturday 23:59:59.999 UTC, inclusive. */
  end: Date
  /** The week-ending Saturday as 'YYYY-MM-DD' (UTC). This is the snapshot_date. */
  weekEnding: string
}

/** Format a Date as a UTC 'YYYY-MM-DD' string. */
function ymdUTC(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The reporting week that CONTAINS `date`. Month/year rollover is handled by
 * Date's own arithmetic (setUTCDate normalizes across boundaries).
 */
export function weekOf(date: Date): ReportingWeek {
  // Snap to UTC midnight of the given calendar day first.
  const midnight = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
  const dow = midnight.getUTCDay() // 0=Sun .. 6=Sat
  const daysSinceStart = (dow - WEEK_START_DAY + 7) % 7

  const start = new Date(midnight)
  start.setUTCDate(midnight.getUTCDate() - daysSinceStart)
  start.setUTCHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  end.setUTCHours(23, 59, 59, 999)

  return { start, end, weekEnding: ymdUTC(end) }
}

/** The reporting week containing `now` (defaults to the current instant). */
export function currentReportingWeek(now: Date = new Date()): ReportingWeek {
  return weekOf(now)
}

/** The reporting week immediately before `week`. */
export function priorWeek(week: ReportingWeek): ReportingWeek {
  // One millisecond before the week's start lands in the previous Saturday.
  return weekOf(new Date(week.start.getTime() - 1))
}

/** The week-ending Saturday ('YYYY-MM-DD', UTC) for the week containing `date`. */
export function weekEnding(date: Date): string {
  return weekOf(date).weekEnding
}
