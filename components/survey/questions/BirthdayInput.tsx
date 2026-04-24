'use client'

/**
 * Three-field month/day/year input for birthdate capture.
 *
 * NOTE: ready-but-unused — the existing survey spec (lib/survey/questions.ts)
 * uses `type: 'date'` (native date input) for Q1 birthdate. Wire this only if
 * the spec updates to a dedicated `birthday` type with split fields.
 *
 * value shape when set: `{ month: number, day: number, year: number, iso?: string }`
 */

import { useMemo } from 'react'

export interface BirthdayValue {
  month?: number
  day?: number
  year?: number
  iso?: string
}

interface BirthdayInputProps {
  value: BirthdayValue | null | undefined
  onChange: (value: BirthdayValue) => void
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function BirthdayInput({ value, onChange }: BirthdayInputProps) {
  const months = MONTHS
  const days = useMemo(() => Array.from({ length: 31 }, (_, i) => i + 1), [])
  const years = useMemo(() => {
    const thisYear = new Date().getUTCFullYear()
    // Allow 18..100 years old
    return Array.from({ length: 83 }, (_, i) => thisYear - 18 - i)
  }, [])

  const update = (patch: Partial<BirthdayValue>) => {
    const next: BirthdayValue = { ...(value ?? {}), ...patch }
    if (next.month && next.day && next.year) {
      const iso = `${next.year}-${String(next.month).padStart(2, '0')}-${String(next.day).padStart(2, '0')}`
      next.iso = iso
    } else {
      delete next.iso
    }
    onChange(next)
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.12em] uppercase text-[color:var(--haevn-muted-fg)]">
          Month
        </span>
        <select
          value={value?.month ?? ''}
          onChange={(e) =>
            update({ month: e.target.value ? Number(e.target.value) : undefined })
          }
          className="haevn-input appearance-none"
        >
          <option value="">—</option>
          {months.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.12em] uppercase text-[color:var(--haevn-muted-fg)]">
          Day
        </span>
        <select
          value={value?.day ?? ''}
          onChange={(e) =>
            update({ day: e.target.value ? Number(e.target.value) : undefined })
          }
          className="haevn-input appearance-none"
        >
          <option value="">—</option>
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs tracking-[0.12em] uppercase text-[color:var(--haevn-muted-fg)]">
          Year
        </span>
        <select
          value={value?.year ?? ''}
          onChange={(e) =>
            update({ year: e.target.value ? Number(e.target.value) : undefined })
          }
          className="haevn-input appearance-none"
        >
          <option value="">—</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
