'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, ChevronDown, ChevronUp, Save } from 'lucide-react'
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
        <Loader2 className="h-6 w-6 animate-spin text-haevn-teal" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Save Button - Full Width at Top */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-haevn-teal hover:opacity-90 text-white rounded-full h-12"
        style={{ fontFamily: 'Roboto, Helvetica, sans-serif', fontWeight: 500 }}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </>
        )}
      </Button>

      {/* Info Card */}
      <div className="rounded-xl bg-haevn-teal/5 border border-haevn-teal/20 p-3">
        <p className="text-xs text-gray-600 text-center">
          These responses help us find your best matches. Update anytime.
        </p>
      </div>

      {/* Survey Sections as Cards */}
      <div className="space-y-3">
        {surveySections.map((section) => (
          <Card key={section.id} className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
            <button
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
              className="w-full text-left"
            >
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base text-haevn-navy">{section.title}</CardTitle>
                  <p className="text-xs text-gray-500 mt-0.5">{section.description}</p>
                </div>
                <div className="p-1.5 rounded-full bg-gray-100">
                  {expandedSection === section.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              </CardHeader>
            </button>

            {expandedSection === section.id && (
              <CardContent className="pt-0 pb-4 space-y-4 border-t border-gray-100">
                <div className="pt-4 space-y-4">
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
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
