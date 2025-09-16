import { createClient } from '@/lib/supabase/client'
import type { SurveyAnswers } from '@/lib/matching/stub'

export interface Partnership {
  id: string
  owner_id: string
  city: string
  membership_tier: 'free' | 'plus' | 'select'
  created_at: string
  survey_responses?: {
    answers_json: SurveyAnswers
    completion_pct: number
  }[]
  partnership_members?: {
    user_id: string
    role: 'owner' | 'member'
    profiles?: {
      full_name: string
    }
  }[]
}

export async function getCurrentUserPartnership(): Promise<Partnership | null> {
  // For localStorage implementation
  const userData = localStorage.getItem('haevn_user')
  const surveyData = localStorage.getItem('haevn_survey_responses')

  if (!userData) return null

  const user = JSON.parse(userData)
  const surveyResponses = surveyData ? JSON.parse(surveyData) : {}

  // Create a mock partnership from user data
  const mockPartnership: Partnership = {
    id: `partnership-${user.email}`,
    owner_id: user.email,
    city: user.city || 'New York',
    membership_tier: user.membershipTier || 'free',
    created_at: new Date().toISOString(),
    survey_responses: [{
      answers_json: surveyResponses,
      completion_pct: user.surveyCompleted ? 100 : 50
    }],
    partnership_members: [{
      user_id: user.email,
      role: 'owner',
      profiles: {
        full_name: user.name || 'Test User'
      }
    }]
  }

  return mockPartnership
}

export async function getCandidatePartnerships(excludeIds: string[] = []): Promise<Partnership[]> {
  // For localStorage implementation, just return demo partnerships
  const demoPartnerships = await getDemoPartnerships()

  // Filter out excluded IDs
  return demoPartnerships.filter(p => !excludeIds.includes(p.id))
}

export async function getPartnershipDisplayName(partnership: Partnership): string {
  // If it's a couple/throuple, combine names
  const members = partnership.partnership_members || []
  const names = members
    .map(m => m.profiles?.full_name)
    .filter(Boolean)
    .slice(0, 3) // Max 3 names

  if (names.length === 0) {
    return 'Anonymous'
  } else if (names.length === 1) {
    return names[0]
  } else if (names.length === 2) {
    return `${names[0]} & ${names[1]}`
  } else {
    return `${names[0]}, ${names[1]} & ${names[2]}`
  }
}

// Mock function for development - returns demo partnerships
export async function getDemoPartnerships(): Promise<Partnership[]> {
  // This is a fallback for when Supabase isn't connected
  return [
    {
      id: 'demo-1',
      owner_id: 'demo-user-1',
      city: 'New York',
      membership_tier: 'plus',
      created_at: new Date().toISOString(),
      survey_responses: [{
        answers_json: {
          identity: {
            gender: 'Female',
            orientation: 'Bisexual',
            relationship_type: ['Open', 'Polyamorous']
          },
          intentions: {
            looking_for: ['Dating', 'Friendship'],
            timeline: 'Within a week'
          },
          boundaries: {
            privacy_level: 'Open',
            photo_sharing: 'After handshake'
          },
          logistics: {
            location_radius: '25 miles',
            availability: ['Weekday evenings', 'Weekends'],
            lifestyle: ['Social', 'Active']
          }
        },
        completion_pct: 100
      }],
      partnership_members: [{
        user_id: 'demo-user-1',
        role: 'owner',
        profiles: {
          full_name: 'Alex Chen'
        }
      }, {
        user_id: 'demo-user-2',
        role: 'member',
        profiles: {
          full_name: 'Jordan Smith'
        }
      }]
    },
    {
      id: 'demo-2',
      owner_id: 'demo-user-3',
      city: 'New York',
      membership_tier: 'select',
      created_at: new Date().toISOString(),
      survey_responses: [{
        answers_json: {
          identity: {
            gender: 'Male',
            orientation: 'Straight',
            relationship_type: ['Monogamous']
          },
          intentions: {
            looking_for: ['Long-term relationship', 'Marriage'],
            timeline: 'No rush'
          },
          boundaries: {
            privacy_level: 'Somewhat private',
            photo_sharing: 'After first message'
          },
          logistics: {
            location_radius: '10 miles',
            availability: ['Weekends'],
            lifestyle: ['Homebody', 'Family-oriented']
          }
        },
        completion_pct: 100
      }],
      partnership_members: [{
        user_id: 'demo-user-3',
        role: 'owner',
        profiles: {
          full_name: 'Sam Wilson'
        }
      }]
    }
  ]
}