export type City = {
  id: string
  name: string
  status: 'live' | 'waitlist'
}

export type User = {
  id: string
  email: string
  name: string
  city_id: string
  survey_completed: boolean
  membership_tier: 'free' | 'plus' | 'select'
  created_at: string
}

export type SurveyResponse = {
  id: string
  user_id: string
  responses: Record<string, any>
  completion_percentage: number
  last_saved_at: string
}

export type Partnership = {
  id: string
  owner_id: string
  name: string
  created_at: string
}