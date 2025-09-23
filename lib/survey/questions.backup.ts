export interface SurveyQuestion {
  id: string
  label: string
  type: 'select' | 'multiselect' | 'text' | 'scale' | 'boolean'
  options?: string[]
  placeholder?: string
  required: boolean
  skipCondition?: (answers: Record<string, any>) => boolean
  tooltip?: string
}

export interface SurveySection {
  id: string
  title: string
  description?: string
  questions: SurveyQuestion[]
}

export const surveySections: SurveySection[] = [
  {
    id: 'identity_orientation',
    title: 'Identity & Orientation',
    description: 'Demographics and basic information about you',
    questions: [
      {
        id: 'pronouns',
        label: 'What are your pronouns?',
        type: 'text',
        placeholder: 'e.g., she/her, he/him, they/them',
        required: true,
        tooltip: 'This helps us refer to you respectfully'
      },
      {
        id: 'age_range',
        label: 'What is your age range?',
        type: 'select',
        options: ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64', '65+'],
        required: true
      },
      {
        id: 'gender_identity',
        label: 'How do you identify?',
        type: 'select',
        options: [
          'Man',
          'Woman',
          'Non-binary',
          'Trans man',
          'Trans woman',
          'Genderqueer',
          'Genderfluid',
          'Prefer to self-describe',
          'Prefer not to say'
        ],
        required: true
      },
      {
        id: 'sexual_orientation',
        label: 'What is your sexual orientation?',
        type: 'multiselect',
        options: [
          'Straight/Heterosexual',
          'Gay',
          'Lesbian',
          'Bisexual',
          'Pansexual',
          'Demisexual',
          'Asexual',
          'Queer',
          'Questioning',
          'Prefer to self-describe'
        ],
        required: true
      },
      {
        id: 'ethnicity',
        label: 'How would you describe your ethnicity? (Optional)',
        type: 'multiselect',
        options: [
          'Asian',
          'Black/African American',
          'Hispanic/Latino',
          'Middle Eastern',
          'Native American',
          'Pacific Islander',
          'White/Caucasian',
          'Multiracial',
          'Prefer not to say'
        ],
        required: false
      }
    ]
  },
  {
    id: 'relationship_style',
    title: 'Relationship Style',
    description: 'Your approach to relationships and what you\'re looking for',
    questions: [
      {
        id: 'relationship_structure',
        label: 'How would you describe your ideal relationship structure?',
        type: 'select',
        options: [
          'Monogamous',
          'Ethically Non-Monogamous (ENM)',
          'Polyamorous',
          'Open Relationship',
          'Relationship Anarchy',
          'Solo Poly',
          'Swinging',
          'Exploring/Curious',
          'It depends on the person'
        ],
        required: true
      },
      {
        id: 'looking_for',
        label: 'What are you looking for on HAEVN?',
        type: 'multiselect',
        options: [
          'Dating',
          'Long-term relationship',
          'Marriage',
          'Casual connections',
          'Friendship',
          'Community',
          'Events & experiences',
          'Exploration',
          'Not sure yet'
        ],
        required: true
      },
      {
        id: 'experience_level',
        label: 'What\'s your experience with non-traditional relationships?',
        type: 'select',
        options: [
          'Very experienced',
          'Some experience',
          'New but researched',
          'Completely new',
          'Prefer not to say'
        ],
        required: true
      },
      {
        id: 'primary_partnership',
        label: 'Do you currently have a primary partner?',
        type: 'select',
        options: [
          'Yes, and they\'re on HAEVN with me',
          'Yes, but they\'re not on HAEVN',
          'No',
          'It\'s complicated',
          'Prefer not to say'
        ],
        required: true
      }
    ]
  },
  {
    id: 'lifestyle_community',
    title: 'Lifestyle & Community',
    description: 'Your lifestyle preferences and community involvement',
    questions: [
      {
        id: 'lifestyle_tags',
        label: 'Select lifestyle tags that describe you:',
        type: 'multiselect',
        options: [
          'Active & Outdoorsy',
          'Arts & Culture',
          'Foodie',
          'Travel Enthusiast',
          'Homebody',
          'Night Owl',
          'Early Bird',
          'Career-focused',
          'Family-oriented',
          'Social Butterfly',
          'Introvert',
          'Spiritual',
          '420 Friendly',
          'Sober',
          'Fitness Enthusiast',
          'Gamer',
          'Book Lover',
          'Music Lover'
        ],
        required: true
      },
      {
        id: 'privacy_level',
        label: 'What\'s your privacy preference?',
        type: 'select',
        options: [
          'Very Private - Discretion is essential',
          'Somewhat Private - Careful who knows',
          'Open - Don\'t mind who knows',
          'Flexible - Depends on context'
        ],
        required: true
      },
      {
        id: 'community_involvement',
        label: 'How involved do you want to be in the HAEVN community?',
        type: 'select',
        options: [
          'Very involved - Events, forums, everything',
          'Moderately involved - Some events and discussions',
          'Minimally involved - Just connections',
          'Not sure yet'
        ],
        required: true
      },
      {
        id: 'location_flexibility',
        label: 'How far are you willing to travel for connections?',
        type: 'select',
        options: [
          'My neighborhood only',
          'Within my city',
          'Within 50 miles',
          'Within my state/region',
          'Anywhere in the country',
          'International'
        ],
        required: true
      }
    ]
  },
  {
    id: 'erotic_map',
    title: 'Erotic Map',
    description: 'Your boundaries, preferences, and approach to intimacy',
    questions: [
      {
        id: 'intimacy_timeline',
        label: 'When are you typically comfortable with physical intimacy?',
        type: 'select',
        options: [
          'First date',
          'After a few dates',
          'Once we\'ve established a connection',
          'After commitment',
          'It varies',
          'Not seeking physical intimacy'
        ],
        required: true
      },
      {
        id: 'safer_sex_practices',
        label: 'What are your safer sex practices?',
        type: 'multiselect',
        options: [
          'Regular STI testing',
          'Barrier methods always',
          'Barrier methods with new partners',
          'PrEP',
          'Open communication about status',
          'Fluid bonding with specific partners only',
          'Prefer not to discuss here'
        ],
        required: true
      },
      {
        id: 'boundaries_importance',
        label: 'How important is discussing boundaries before intimacy?',
        type: 'select',
        options: [
          'Essential - Must discuss everything first',
          'Very Important - Major boundaries discussed',
          'Important - Basic boundaries discussed',
          'Somewhat Important - Discuss as we go',
          'Not Important - Go with the flow'
        ],
        required: true
      },
      {
        id: 'communication_style',
        label: 'Your communication style around desires and boundaries:',
        type: 'select',
        options: [
          'Very direct and explicit',
          'Direct but gentle',
          'Hints and suggestions',
          'Non-verbal cues',
          'Still learning to communicate'
        ],
        required: true
      }
    ]
  },
  {
    id: 'kink_exploration',
    title: 'Optional Exploration',
    description: 'Optional section about kinks and exploration (you can skip this)',
    questions: [
      {
        id: 'kink_interest',
        label: 'Are you interested in kink/BDSM?',
        type: 'select',
        options: [
          'Very experienced',
          'Some experience',
          'Curious and want to learn',
          'Not interested',
          'Prefer not to say'
        ],
        required: false,
        skipCondition: (answers) => answers.skip_kink_section === true
      },
      {
        id: 'kink_role',
        label: 'If interested in kink, how do you identify?',
        type: 'multiselect',
        options: [
          'Dominant',
          'Submissive',
          'Switch',
          'Top',
          'Bottom',
          'Verse',
          'Exploring',
          'Not applicable'
        ],
        required: false,
        skipCondition: (answers) =>
          answers.kink_interest === 'Not interested' ||
          answers.skip_kink_section === true
      },
      {
        id: 'kink_interests',
        label: 'What aspects interest you? (Optional)',
        type: 'multiselect',
        options: [
          'Bondage',
          'Discipline',
          'Dominance/submission',
          'Sensation play',
          'Role play',
          'Impact play',
          'Power exchange',
          'Still exploring',
          'Prefer not to specify'
        ],
        required: false,
        skipCondition: (answers) =>
          answers.kink_interest === 'Not interested' ||
          answers.skip_kink_section === true
      }
    ]
  },
  {
    id: 'personality_insights',
    title: 'Personality Insights',
    description: 'Help us understand your relationship personality',
    questions: [
      {
        id: 'conflict_style',
        label: 'How do you typically handle conflict in relationships?',
        type: 'select',
        options: [
          'Address immediately and directly',
          'Take time to cool down first',
          'Avoid if possible',
          'Seek mediation or third party help',
          'Depends on the situation'
        ],
        required: true
      },
      {
        id: 'love_languages',
        label: 'What are your primary love languages?',
        type: 'multiselect',
        options: [
          'Words of affirmation',
          'Acts of service',
          'Receiving gifts',
          'Quality time',
          'Physical touch'
        ],
        required: true
      },
      {
        id: 'attachment_style',
        label: 'Which best describes your attachment style?',
        type: 'select',
        options: [
          'Secure - Comfortable with intimacy and independence',
          'Anxious - Crave closeness but worry about the relationship',
          'Avoidant - Value independence over intimacy',
          'Disorganized - Mixed feelings about relationships',
          'Not sure'
        ],
        required: true
      },
      {
        id: 'ideal_date',
        label: 'Describe your ideal first date:',
        type: 'multiselect',
        options: [
          'Coffee or tea chat',
          'Dinner at a nice restaurant',
          'Outdoor activity',
          'Cultural event (museum, show, etc)',
          'Casual drinks',
          'Home cooked meal',
          'Adventure or new experience',
          'Virtual date',
          'Group hangout'
        ],
        required: true
      },
      {
        id: 'dealbreakers',
        label: 'What are your absolute dealbreakers? (Optional)',
        type: 'text',
        placeholder: 'e.g., smoking, different political views, etc.',
        required: false
      }
    ]
  }
]

/**
 * Get all questions from all sections
 */
export function getAllQuestions(): SurveyQuestion[] {
  return surveySections.flatMap(section => section.questions)
}

/**
 * Get active questions based on skip logic and answers
 */
export function getActiveQuestions(answers: Record<string, any>): SurveyQuestion[] {
  const activeQuestions: SurveyQuestion[] = []

  surveySections.forEach(section => {
    section.questions.forEach(question => {
      // Check if question should be skipped
      if (question.skipCondition && question.skipCondition(answers)) {
        return
      }
      activeQuestions.push(question)
    })
  })

  return activeQuestions
}

/**
 * Calculate completion percentage
 */
export function calculateSurveyCompletion(answers: Record<string, any>): number {
  const activeQuestions = getActiveQuestions(answers)
  const requiredQuestions = activeQuestions.filter(q => q.required)

  if (requiredQuestions.length === 0) return 100

  const answeredRequired = requiredQuestions.filter(q => {
    const answer = answers[q.id]
    if (Array.isArray(answer)) return answer.length > 0
    return answer !== undefined && answer !== null && answer !== ''
  })

  return Math.round((answeredRequired.length / requiredQuestions.length) * 100)
}