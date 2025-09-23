'use client'

import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
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
    if (!question.tooltip) return null

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{question.tooltip}</p>
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
        <RadioGroup
          value={value || ''}
          onValueChange={onChange}
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

      {question.type === 'scale' && (
        <div className="space-y-4 max-w-md">
          <Slider
            value={[value || 5]}
            onValueChange={(values) => onChange(values[0])}
            max={10}
            min={1}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>1</span>
            <span className="font-medium text-foreground">
              {value || 5}
            </span>
            <span>10</span>
          </div>
        </div>
      )}
    </div>
  )
}