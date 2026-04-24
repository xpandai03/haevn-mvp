'use client'

/**
 * Large selectable cards for multi-option intent questions.
 *
 * NOTE: ready-but-unused — the existing survey spec (lib/survey/questions.ts)
 * does not declare any question of this type. Wire this into QuestionRenderer
 * only after the spec adds it (e.g. `type: 'intent_cards'`).
 */

import { Check } from 'lucide-react'

export interface IntentOption {
  key: string
  text: string
  tagline?: string
  description?: string
  footer?: string
}

interface IntentCardsProps {
  options: IntentOption[]
  value: string | null | undefined
  onChange: (value: string) => void
}

export function IntentCards({ options, value, onChange }: IntentCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-1">
      {options.map((opt) => {
        const isSelected = value === opt.key
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`survey-option flex-col items-start text-left !min-h-0 py-6 ${
              isSelected ? 'is-selected' : ''
            }`}
            aria-pressed={isSelected}
          >
            <div className="flex items-start justify-between w-full gap-3">
              <div className="flex-1 space-y-1">
                <p className="font-heading text-lg font-medium text-[color:var(--haevn-navy)]">
                  {opt.text}
                </p>
                {opt.tagline && (
                  <p className="text-sm italic text-[color:var(--haevn-charcoal)]">
                    {opt.tagline}
                  </p>
                )}
              </div>
              {isSelected && (
                <Check
                  className="w-5 h-5 shrink-0 text-[color:var(--haevn-teal)]"
                  strokeWidth={2.5}
                />
              )}
            </div>
            {opt.description && (
              <p className="text-sm text-[color:var(--haevn-muted-fg)] leading-relaxed">
                {opt.description}
              </p>
            )}
            {opt.footer && (
              <p className="text-xs uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
                {opt.footer}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}
