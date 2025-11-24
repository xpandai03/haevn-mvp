/**
 * Survey Data Display Component
 * Displays categorized survey responses in a clean format
 */

interface SurveyDataSectionProps {
  title: string
  data: Record<string, any>
}

export function SurveyDataSection({ title, data }: SurveyDataSectionProps) {
  const entries = Object.entries(data).filter(([_, value]) => value !== undefined && value !== null)

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-haevn-navy">{title}</h3>
      <div className="space-y-2">
        {entries.map(([label, value]) => (
          <div key={label} className="bg-haevn-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium text-haevn-charcoal/60 mb-1">{label}</p>
            <p className="text-haevn-charcoal">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

interface SurveyDataDisplayProps {
  surveyData: Record<string, Record<string, any>>
  category: 'goals' | 'communication' | 'energy' | 'boundaries' | 'interests' | 'bodyType' | 'loveLanguages' | 'kinks' | 'preferences'
}

const CATEGORY_TITLES: Record<string, string> = {
  goals: 'Goals & Intentions',
  communication: 'Communication Style',
  energy: 'Energy & Lifestyle',
  boundaries: 'Boundaries',
  interests: 'Interests & Hobbies',
  bodyType: 'Physical Preferences',
  loveLanguages: 'Love Languages',
  kinks: 'Intimacy Preferences',
  preferences: 'General Preferences'
}

export function SurveyDataDisplay({ surveyData, category }: SurveyDataDisplayProps) {
  const categoryData = surveyData[category]

  if (!categoryData) {
    return (
      <p className="text-haevn-charcoal/60 text-center py-8">
        No data available for this section
      </p>
    )
  }

  return (
    <SurveyDataSection title={CATEGORY_TITLES[category]} data={categoryData} />
  )
}