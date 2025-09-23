'use client'

import { useEffect, useState } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
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
      // Only advance on Enter if we can advance and have a handler
      if (e.key === 'Enter' && canAdvance && onEnterPress) {
        // Prevent form submission if we're in a form
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Label className="text-lg font-medium">{question.label}</Label>
        {renderTooltip()}
      </div>

      {question.type === 'select' && question.options && (
        <div className="space-y-3">
          <RadioGroup
            value={showCustomInput ? 'Other (please specify)' : (value || '')}
            onValueChange={(newValue) => {
              if (newValue.includes('Other')) {
                setShowCustomInput(true)
                setCustomValue('')
              } else {
                setShowCustomInput(false)
                onChange(newValue)
              }
            }}
            className="space-y-3"
          >
            {question.options.map((option) => (
              <div key={option} className="flex items-center space-x-3">
                <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="font-normal cursor-pointer flex-1"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>

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
              className="mt-2 max-w-md"
              autoFocus
            />
          )}
        </div>
      )}

      {question.type === 'multiselect' && question.options && (
        <div className="space-y-3">
          {question.options.map((option) => (
            <div key={option} className="flex items-center space-x-3">
              <Checkbox
                id={`${question.id}-${option}`}
                checked={value?.includes(option) || false}
                onCheckedChange={(checked) => {
                  const currentValue = value || []
                  if (checked) {
                    onChange([...currentValue, option])
                  } else {
                    onChange(currentValue.filter((v: string) => v !== option))
                  }
                }}
              />
              <Label
                htmlFor={`${question.id}-${option}`}
                className="font-normal cursor-pointer flex-1"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
      )}

      {question.type === 'text' && (
        <Input
          type="text"
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // For text inputs, only advance on Enter if field is not empty
            if (e.key === 'Enter' && value && onEnterPress && canAdvance) {
              e.preventDefault()
              onEnterPress()
            }
          }}
          className="max-w-md"
        />
      )}

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
          className="max-w-[200px]"
        />
      )}

      {question.type === 'textarea' && (
        <Textarea
          placeholder={question.placeholder}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="max-w-2xl min-h-[100px]"
          rows={4}
        />
      )}

      {(question.type === 'scale' || question.type === 'slider') && (
        <div className="space-y-4 max-w-md">
          <Slider
            value={[value || (question.min !== undefined ? question.min : 5)]}
            onValueChange={(values) => onChange(values[0])}
            max={question.max || 10}
            min={question.min !== undefined ? question.min : 1}
            step={question.step || 1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{question.min !== undefined ? question.min : 1}</span>
            <span className="font-medium text-foreground">
              {value !== undefined && value !== null ? value : (question.min !== undefined ? question.min : 5)}
            </span>
            <span>{question.max || 10}</span>
          </div>
        </div>
      )}
    </div>
  )
}