'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { SurveyQuestion } from '@/lib/survey/questions'

interface QuestionRendererProps {
  question: SurveyQuestion
  value: any
  onChange: (value: any) => void
  onEnterPress?: () => void
  canAdvance?: boolean
}

export function QuestionRenderer({
  question,
  value,
  onChange,
  onEnterPress,
  canAdvance = false
}: QuestionRendererProps) {
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customValue, setCustomValue] = useState('')
  const [showInfoPopover, setShowInfoPopover] = useState(false)

  // Check if value is a custom option (for "Other" selections)
  useEffect(() => {
    if (question.type === 'select' && value && !question.options?.includes(value)) {
      setShowCustomInput(true)
      setCustomValue(value)
    }
  }, [value, question])

  // Handle Enter key press to advance to next question
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

  const renderTooltip = () => {
    const tooltipText = question.helperText || question.tooltip
    if (!tooltipText) return null

    return (
      <TooltipProvider>
        <Tooltip open={showInfoPopover} onOpenChange={setShowInfoPopover}>
          <TooltipTrigger asChild>
            <button
              className="flex-shrink-0 p-1.5 text-haevn-teal hover:opacity-80 rounded-full transition-opacity"
              aria-label="More information"
            >
              <Info className="w-5 h-5" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            align="start"
            className="max-w-xs p-4 bg-white border-haevn-teal"
          >
            <p
              className="text-sm text-haevn-charcoal leading-relaxed"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300,
                lineHeight: '120%',
                textAlign: 'left'
              }}
            >
              {tooltipText}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-6">
      {/* Question Label with Info Icon */}
      <div className="flex items-start gap-3">
        <h3
          className="text-3xl lg:text-4xl text-haevn-navy leading-tight"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 700,
            lineHeight: '100%',
            letterSpacing: '-0.015em',
            textAlign: 'left'
          }}
        >
          {question.label}
        </h3>
        {renderTooltip()}
      </div>

      {/* SELECT - Single choice with cards */}
      {question.type === 'select' && question.options && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((option) => (
              <button
                key={option}
                onClick={() => {
                  if (option.includes('Other')) {
                    setShowCustomInput(true)
                    setCustomValue('')
                  } else {
                    setShowCustomInput(false)
                    onChange(option)
                  }
                }}
                className={`
                  relative p-4 rounded-2xl border-2 text-left transition-all duration-200
                  ${(showCustomInput && option.includes('Other')) || value === option
                    ? 'border-haevn-teal bg-white shadow-sm'
                    : 'border-haevn-navy bg-white hover:bg-haevn-lightgray/30'
                  }
                `}
              >
                <span
                  className="text-base text-haevn-charcoal"
                  style={{
                    fontFamily: 'Roboto, Helvetica, sans-serif',
                    fontWeight: 500
                  }}
                >
                  {option}
                </span>
                {((showCustomInput && option.includes('Other')) || value === option) && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-haevn-teal flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>

          {showCustomInput && (
            <Input
              type="text"
              placeholder="Please specify..."
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
              className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
              autoFocus
            />
          )}
        </div>
      )}

      {/* MULTISELECT - Multiple choice with cards */}
      {question.type === 'multiselect' && question.options && (
        <div className="space-y-3">
          <p
            className="text-sm text-haevn-charcoal mb-4"
            style={{
              fontFamily: 'Roboto, Helvetica, sans-serif',
              fontWeight: 300,
              lineHeight: '120%',
              textAlign: 'left'
            }}
          >
            Select all that apply
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {question.options.map((option) => {
              const isSelected = value?.includes(option) || false
              return (
                <button
                  key={option}
                  onClick={() => {
                    const currentValue = value || []
                    if (isSelected) {
                      onChange(currentValue.filter((v: string) => v !== option))
                    } else {
                      onChange([...currentValue, option])
                    }
                  }}
                  className={`
                    relative p-4 rounded-2xl border-2 text-left transition-all duration-200
                    ${isSelected
                      ? 'border-haevn-teal bg-white shadow-sm'
                      : 'border-haevn-navy bg-white hover:bg-haevn-lightgray/30'
                    }
                  `}
                >
                  <span
                    className="text-base text-haevn-charcoal"
                    style={{
                      fontFamily: 'Roboto, Helvetica, sans-serif',
                      fontWeight: 500
                    }}
                  >
                    {option}
                  </span>
                  {isSelected && (
                    <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-haevn-teal flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* TEXT INPUT */}
      {question.type === 'text' && (
        <Input
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
          className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 300
          }}
        />
      )}

      {/* NUMBER INPUT */}
      {question.type === 'number' && (
        <Input
          type="number"
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(parseInt(e.target.value) || '')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value && onEnterPress && canAdvance) {
              e.preventDefault()
              onEnterPress()
            }
          }}
          min={question.min}
          max={question.max}
          className="w-full max-w-[200px] px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 500
          }}
        />
      )}

      {/* TEXTAREA */}
      {question.type === 'textarea' && (
        <Textarea
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-4 py-3 bg-white border-2 border-haevn-navy rounded-xl text-base text-haevn-charcoal placeholder:text-haevn-charcoal/40 focus:outline-none focus:border-haevn-teal focus:ring-2 focus:ring-haevn-teal/20 min-h-[120px]"
          style={{
            fontFamily: 'Roboto, Helvetica, sans-serif',
            fontWeight: 300,
            lineHeight: '120%'
          }}
          rows={4}
        />
      )}

      {/* SCALE / SLIDER */}
      {(question.type === 'scale' || question.type === 'slider') && (
        <div className="space-y-4">
          <Slider
            value={[value || (question.min !== undefined ? question.min : 5)]}
            onValueChange={(values) => onChange(values[0])}
            max={question.max || 10}
            min={question.min !== undefined ? question.min : 1}
            step={question.step || 1}
            className="w-full"
          />
          <div className="flex justify-between items-center">
            <span
              className="text-sm text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
            >
              {question.min !== undefined ? question.min : 1}
            </span>
            <span
              className="text-2xl text-haevn-navy"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 700
              }}
            >
              {value !== undefined && value !== null ? value : (question.min !== undefined ? question.min : 5)}
            </span>
            <span
              className="text-sm text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 300
              }}
            >
              {question.max || 10}
            </span>
          </div>
        </div>
      )}

      {/* BOOLEAN */}
      {question.type === 'boolean' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onChange(true)}
            className={`
              relative p-4 rounded-2xl border-2 text-center transition-all duration-200
              ${value === true
                ? 'border-haevn-teal bg-white shadow-sm'
                : 'border-haevn-navy bg-white hover:bg-haevn-lightgray/30'
              }
            `}
          >
            <span
              className="text-base text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              Yes
            </span>
            {value === true && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-haevn-teal flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
          <button
            onClick={() => onChange(false)}
            className={`
              relative p-4 rounded-2xl border-2 text-center transition-all duration-200
              ${value === false
                ? 'border-haevn-teal bg-white shadow-sm'
                : 'border-haevn-navy bg-white hover:bg-haevn-lightgray/30'
              }
            `}
          >
            <span
              className="text-base text-haevn-charcoal"
              style={{
                fontFamily: 'Roboto, Helvetica, sans-serif',
                fontWeight: 500
              }}
            >
              No
            </span>
            {value === false && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-haevn-teal flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}
          </button>
        </div>
      )}
    </div>
  )
}