'use client'

import { useEffect, useState } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Info, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SurveyQuestion } from '@/lib/survey/questions'

interface QuestionRendererProps {
  question: SurveyQuestion
  value: any
  onChange: (value: any) => void
  onEnterPress?: () => void
  canAdvance?: boolean
}

const OTHER_MATCHER = /^Other\b|\bOther$/i
const isOtherOption = (option: string) => OTHER_MATCHER.test(option)

export function QuestionRenderer({
  question,
  value,
  onChange,
  onEnterPress,
  canAdvance = false,
}: QuestionRendererProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [showInfoPopover, setShowInfoPopover] = useState(false)

  // Detect a free-typed custom value coming back from storage (single select "Other")
  useEffect(() => {
    if (
      question.type === 'select' &&
      typeof value === 'string' &&
      value.length > 0 &&
      !question.options?.includes(value)
    ) {
      setShowCustomInput(true)
      setCustomValue(value)
    }
  }, [value, question])

  // Enter to advance (only when the current answer makes advance legal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && canAdvance && onEnterPress) {
        e.preventDefault()
        onEnterPress()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [canAdvance, onEnterPress])

  const renderInfoButton = () => {
    const infoText = question.helperText || question.tooltip
    if (!infoText) return null

    return (
      <>
        <button
          type="button"
          onClick={() => setShowInfoPopover(true)}
          className="flex-shrink-0 p-1.5 text-[color:var(--haevn-teal)] hover:opacity-80 transition-opacity"
          aria-label="More information"
        >
          <Info className="w-5 h-5" strokeWidth={1.5} />
        </button>
        <Dialog open={showInfoPopover} onOpenChange={setShowInfoPopover}>
          <DialogContent className="max-w-sm mx-4 rounded-none border border-[color:var(--haevn-border)] p-0 overflow-hidden">
            <div className="p-6">
              <DialogHeader className="mb-3">
                <DialogTitle className="text-lg text-[color:var(--haevn-navy)] font-heading font-medium">
                  About this question
                </DialogTitle>
              </DialogHeader>
              <p className="text-sm text-[color:var(--haevn-charcoal)] leading-relaxed">
                {infoText}
              </p>
              <button
                type="button"
                onClick={() => setShowInfoPopover(false)}
                className="haevn-btn-teal w-full mt-5 text-sm"
              >
                Got it
              </button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="space-y-6">
      {/* Question label + info */}
      <div className="flex items-start gap-3">
        <h2 className="font-heading text-xl sm:text-2xl leading-snug font-medium text-[color:var(--haevn-navy)] flex-1">
          {question.label}
        </h2>
        {renderInfoButton()}
      </div>

      {/* Subtext / description */}
      {question.subtext && (
        <p className="text-sm sm:text-base text-[color:var(--haevn-muted-fg)] leading-relaxed whitespace-pre-line -mt-3">
          {question.subtext}
        </p>
      )}

      {/* SELECT — single choice */}
      {question.type === 'select' && question.options && (
        <div className="space-y-3">
          <div className="space-y-2">
            {question.options.map((option) => {
              const isOther = isOtherOption(option)
              const isSelected =
                (isOther && showCustomInput) ||
                (!isOther && value === option)

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    if (isOther) {
                      setShowCustomInput(true)
                      setCustomValue('')
                      onChange('')
                    } else {
                      setShowCustomInput(false)
                      setCustomValue('')
                      onChange(option)
                    }
                  }}
                  className={`survey-option ${isSelected ? 'is-selected' : ''}`}
                  aria-pressed={isSelected}
                >
                  <span className="text-sm sm:text-base flex-1">{option}</span>
                  {isSelected && (
                    <Check
                      className="w-4 h-4 ml-3 text-[color:var(--haevn-teal)]"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              )
            })}
          </div>

          {showCustomInput && (
            <input
              type="text"
              placeholder="Please specify…"
              value={customValue}
              onChange={(e) => {
                setCustomValue(e.target.value)
                onChange(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customValue && onEnterPress && canAdvance) {
                  e.preventDefault()
                  onEnterPress()
                }
              }}
              className="haevn-input"
              autoFocus
            />
          )}
        </div>
      )}

      {/* MULTISELECT — multi choice */}
      {question.type === 'multiselect' && question.options && (
        <div className="space-y-3">
          <p className="text-xs tracking-[0.12em] uppercase text-[color:var(--haevn-muted-fg)]">
            Select all that apply
          </p>
          <div className="space-y-2">
            {question.options.map((option) => {
              const isSelected = Array.isArray(value) && value.includes(option)
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const current: string[] = Array.isArray(value) ? value : []
                    onChange(
                      isSelected
                        ? current.filter((v) => v !== option)
                        : [...current, option]
                    )
                  }}
                  className={`survey-option-multi ${isSelected ? 'is-selected' : ''}`}
                  aria-pressed={isSelected}
                >
                  <span className="text-sm sm:text-base flex-1">{option}</span>
                  {isSelected && (
                    <Check
                      className="w-4 h-4 ml-3 text-[color:var(--haevn-teal)]"
                      strokeWidth={2.5}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* TEXT */}
      {question.type === 'text' && (
        <input
          type="text"
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value && onEnterPress && canAdvance) {
              e.preventDefault()
              onEnterPress()
            }
          }}
          className="haevn-input"
        />
      )}

      {/* NUMBER */}
      {question.type === 'number' && (
        <input
          type="number"
          placeholder={question.placeholder}
          value={value ?? ''}
          onChange={(e) => {
            const raw = e.target.value
            onChange(raw === '' ? '' : Number.parseInt(raw, 10))
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value !== '' && value !== undefined && onEnterPress && canAdvance) {
              e.preventDefault()
              onEnterPress()
            }
          }}
          min={question.min}
          max={question.max}
          className="haevn-input max-w-[240px]"
          inputMode="numeric"
        />
      )}

      {/* DATE */}
      {question.type === 'date' && (
        <input
          type="date"
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value && onEnterPress && canAdvance) {
              e.preventDefault()
              onEnterPress()
            }
          }}
          max={new Date().toISOString().split('T')[0]}
          className="haevn-input max-w-[320px]"
        />
      )}

      {/* TEXTAREA */}
      {question.type === 'textarea' && (
        <Textarea
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="haevn-textarea min-h-[140px] rounded-none border border-[color:var(--haevn-border)] focus-visible:ring-0 focus-visible:border-[color:var(--haevn-teal)] text-sm sm:text-base"
          rows={5}
        />
      )}

      {/* SCALE / SLIDER — rendered as 1..N horizontal likert-style bar */}
      {(question.type === 'scale' || question.type === 'slider') && (
        <ScaleInput
          value={value}
          min={question.min ?? 1}
          max={question.max ?? 10}
          step={question.step ?? 1}
          onChange={onChange}
        />
      )}

      {/* BOOLEAN */}
      {question.type === 'boolean' && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Yes', val: true },
            { label: 'No', val: false },
          ].map(({ label, val }) => {
            const isSelected = value === val
            return (
              <button
                key={label}
                type="button"
                onClick={() => onChange(val)}
                className={`survey-option justify-center ${isSelected ? 'is-selected' : ''}`}
                aria-pressed={isSelected}
              >
                <span className="text-base">{label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ScaleInputProps {
  value: number | undefined
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

function ScaleInput({ value, min, max, step, onChange }: ScaleInputProps) {
  const steps: number[] = []
  for (let i = min; i <= max; i += step) steps.push(i)

  const current =
    typeof value === 'number' && Number.isFinite(value) ? value : undefined

  // If the scale is small (≤10 buttons) render as a segmented bar;
  // otherwise fall back to a native range input to stay usable on mobile.
  if (steps.length <= 10) {
    return (
      <div className="space-y-4">
        <div className="flex w-full">
          {steps.map((n) => {
            const isSelected = current === n
            return (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`likert-option ${isSelected ? 'is-selected' : ''}`}
                aria-pressed={isSelected}
              >
                {n}
              </button>
            )
          })}
        </div>
        <div className="flex justify-between text-xs uppercase tracking-[0.12em] text-[color:var(--haevn-muted-fg)]">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <input
        type="range"
        value={current ?? min}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[color:var(--haevn-teal)]"
      />
      <div className="flex justify-between items-center text-[color:var(--haevn-muted-fg)]">
        <span className="text-sm">{min}</span>
        <span className="font-heading text-2xl text-[color:var(--haevn-navy)]">
          {current ?? min}
        </span>
        <span className="text-sm">{max}</span>
      </div>
    </div>
  )
}
