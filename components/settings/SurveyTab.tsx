'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import { getUserSurveyData, saveUserSurveyData } from '@/lib/actions/survey-user'
import { surveySections } from '@/lib/survey/questions'
import { QuestionRenderer } from '@/components/survey/QuestionRenderer'

export function SurveyTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  useEffect(() => {
    async function loadSurvey() {
      const { data, error } = await getUserSurveyData()
      if (data && !error) {
        setAnswers(data.answers_json || {})
      }
      setLoading(false)
    }

    loadSurvey()
  }, [])

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers({ ...answers, [questionId]: value })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const { success, error } = await saveUserSurveyData(answers, 0)

      if (success) {
        toast({
          title: 'Survey Updated',
          description: 'Your survey responses have been saved.',
        })
      } else {
        throw new Error(error || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving survey:', error)
      toast({
        title: 'Error',
        description: 'Failed to save survey. Please try again.',
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-haevn-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-h3 text-haevn-gray-900 mb-4">Survey Responses</h3>
        <p className="text-body-sm text-haevn-gray-600 mb-6">
          Review and update your survey answers. These help us find your best matches.
        </p>
      </div>

      <div className="space-y-4">
        {surveySections.map((section) => (
          <div key={section.id} className="border-2 border-haevn-gray-300 rounded-lg">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full px-4 py-3 flex justify-between items-center hover:bg-haevn-gray-50 transition-colors"
            >
              <div className="text-left">
                <h4 className="font-medium text-haevn-gray-900">{section.title}</h4>
                <p className="text-sm text-haevn-gray-600">{section.description}</p>
              </div>
              <span className="text-haevn-gray-600">
                {expandedSection === section.id ? '−' : '+'}
              </span>
            </button>

            {expandedSection === section.id && (
              <div className="px-4 pb-4 space-y-6 border-t border-haevn-gray-300 pt-4">
                {section.questions.map((question) => (
                  <div key={question.id} className="space-y-2">
                    <QuestionRenderer
                      question={question}
                      value={answers[question.id]}
                      onChange={(value) => handleAnswerChange(question.id, value)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-haevn-teal-500 hover:bg-haevn-teal-600 text-white"
        >
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
