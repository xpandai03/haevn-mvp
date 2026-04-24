'use client'

/**
 * 1–5 horizontal likert scale with labeled endpoints.
 *
 * NOTE: ready-but-unused — the existing survey spec (lib/survey/questions.ts)
 * uses `scale` / `slider` for numeric likert-ish questions. The QuestionRenderer
 * already renders those as a segmented bar when the range is ≤10 steps, which
 * covers most needs. Wire this dedicated component in only if the spec adds
 * `likert_1_5` / `likert_1_5_balanced` types that need explicit endpoint labels.
 */

interface LikertScaleProps {
  value: number | null | undefined
  onChange: (value: number) => void
  minLabel?: string
  maxLabel?: string
  /** Defaults to 1–5 ("balanced" variant is just `_balanced` labels). */
  min?: number
  max?: number
}

export function LikertScale({
  value,
  onChange,
  minLabel = 'Strongly disagree',
  maxLabel = 'Strongly agree',
  min = 1,
  max = 5,
}: LikertScaleProps) {
  const steps: number[] = []
  for (let i = min; i <= max; i += 1) steps.push(i)

  return (
    <div className="space-y-4">
      <div className="flex w-full">
        {steps.map((n) => {
          const isSelected = value === n
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`likert-option ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected}
              aria-label={`Rating ${n} of ${max}`}
            >
              {n}
            </button>
          )
        })}
      </div>
      <div className="flex justify-between text-xs uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  )
}
