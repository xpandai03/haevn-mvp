export interface SurveyQuestion {
  id: string
  label: string
  type: 'select' | 'multiselect' | 'text' | 'scale'
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
    id: 'identity',
    title: 'Identity',
    description: 'Tell us about yourself',
    questions: [
      {
        id: 'identity_pronouns',
        label: 'What are your pronouns?',
        type: 'text',
        placeholder: 'e.g., she/her, he/him, they/them',
        required: true,
        tooltip: 'This helps us refer to you respectfully'
      },
      {
        id: 'identity_age_range',
        label: 'What is your age range?',
        type: 'select',
        options: ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60+'],
        required: true,
        tooltip: 'We never share your exact age, only the range'
      },
      {
        id: 'identity_gender',
        label: 'How do you identify?',
        type: 'select',
        options: ['Man', 'Woman', 'Non-binary', 'Transgender', 'Prefer not to say', 'Prefer to self-describe'],
        required: true
      },
      {
        id: 'identity_orientation',
        label: 'What is your sexual orientation?',
        type: 'select',
        options: ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Asexual', 'Queer', 'Questioning', 'Prefer not to say'],
        required: true
      },
      {
        id: 'identity_relationship_structure',
        label: 'Are you joining HAEVN as...',
        type: 'select',
        options: ['Solo', 'With a Partner', 'As a Pod (3+ people)'],
        required: true,
        tooltip: 'This determines whether we need to invite partners to complete the survey'
      }
    ]
  },
  {
    id: 'intentions',
    title: 'Intentions',
    description: 'What brings you to HAEVN?',
    questions: [
      {
        id: 'intentions_looking_for',
        label: 'What are you looking for on HAEVN?',
        type: 'multiselect',
        options: ['Dating', 'Friendship', 'Casual encounters', 'Long-term relationship', 'Marriage', 'Community', 'Exploration'],
        required: true,
        tooltip: 'Select all that apply - be honest about your intentions'
      },
      {
        id: 'intentions_timeline',
        label: 'How soon are you looking to meet someone?',
        type: 'select',
        options: ['As soon as possible', 'Within a week', 'Within a month', 'No rush', 'Just browsing'],
        required: true
      },
      {
        id: 'intentions_marriage_minded',
        label: 'Are you looking for marriage?',
        type: 'select',
        options: ['Yes', 'No', 'Open to it'],
        required: true
      },
      {
        id: 'intentions_children_interest',
        label: 'Do you want children?',
        type: 'select',
        options: ['Yes', 'No', 'Maybe', 'Have children already', 'Open to partner with children'],
        required: true,
        skipCondition: (answers) => answers['intentions_marriage_minded'] !== 'Yes',
        tooltip: 'This helps us match you with compatible partners'
      }
    ]
  },
  {
    id: 'boundaries',
    title: 'Boundaries & Discretion',
    description: 'Your comfort zones and privacy preferences',
    questions: [
      {
        id: 'boundaries_relationship_orientation',
        label: 'What type of relationship structure are you seeking?',
        type: 'select',
        options: ['Monogamous', 'Polyamorous', 'Open Relationship', 'Flexible/Exploring'],
        required: true,
        tooltip: 'This is one of our most important matching criteria'
      },
      {
        id: 'boundaries_privacy_level',
        label: 'How private do you want to be?',
        type: 'select',
        options: ['Very Private', 'Somewhat Private', 'Open', 'Flexible'],
        required: true,
        tooltip: 'This affects what information is visible on your profile'
      },
      {
        id: 'boundaries_photo_sharing',
        label: 'When are you comfortable sharing photos?',
        type: 'select',
        options: ['After handshake (mutual like)', 'After first message', 'After meeting in person', 'Never'],
        required: true,
        tooltip: 'Note: In HAEVN, photos are always private until a handshake'
      },
      {
        id: 'boundaries_dealbreakers',
        label: 'What are your dealbreakers?',
        type: 'multiselect',
        options: [
          'Smoking',
          'Heavy drinking',
          'Drug use',
          'Different religion',
          'Different politics',
          'Has children',
          'Wants children',
          'Long distance',
          'Not verified',
          'Closed relationship when I want open',
          'Open relationship when I want closed'
        ],
        required: true,
        tooltip: 'We\'ll never match you with someone who conflicts with these'
      }
    ]
  },
  {
    id: 'logistics',
    title: 'Logistics',
    description: 'Practical considerations for matching',
    questions: [
      {
        id: 'logistics_city',
        label: 'Confirm your city',
        type: 'text',
        placeholder: 'City name',
        required: true,
        tooltip: 'This was detected from your ZIP code during signup'
      },
      {
        id: 'logistics_location_radius',
        label: 'How far are you willing to travel for dates?',
        type: 'select',
        options: ['5 miles', '10 miles', '25 miles', '50 miles', '100+ miles', 'Anywhere'],
        required: true
      },
      {
        id: 'logistics_availability',
        label: 'When are you typically available?',
        type: 'multiselect',
        options: [
          'Weekday mornings',
          'Weekday afternoons',
          'Weekday evenings',
          'Weekend mornings',
          'Weekend afternoons',
          'Weekend evenings',
          'Flexible schedule'
        ],
        required: true
      },
      {
        id: 'logistics_lifestyle_tags',
        label: 'Select lifestyle tags that describe you',
        type: 'multiselect',
        options: [
          'Active/Fitness',
          'Foodie',
          'Traveler',
          'Homebody',
          'Night owl',
          'Early bird',
          'Creative',
          'Professional',
          'Spiritual',
          'Social butterfly',
          'Introvert',
          'Extrovert',
          'Pet parent',
          '420 friendly',
          'Sober',
          'Kink friendly',
          'Vanilla',
          'Bookworm',
          'Gamer',
          'Outdoorsy'
        ],
        required: true,
        skipCondition: (answers) => answers['boundaries_privacy_level'] === 'Very Private',
        tooltip: 'Select 3-10 tags that best represent your lifestyle'
      }
    ]
  }
]

/**
 * Get all questions flattened from sections
 */
export function getAllQuestions(): SurveyQuestion[] {
  return surveySections.flatMap(section => section.questions)
}

/**
 * Get question by ID
 */
export function getQuestionById(questionId: string): SurveyQuestion | undefined {
  return getAllQuestions().find(q => q.id === questionId)
}

/**
 * Get next question based on current answers and skip logic
 */
export function getNextQuestion(
  currentQuestionId: string,
  answers: Record<string, any>
): SurveyQuestion | null {
  const allQuestions = getAllQuestions()
  const currentIndex = allQuestions.findIndex(q => q.id === currentQuestionId)

  if (currentIndex === -1 || currentIndex === allQuestions.length - 1) {
    return null
  }

  // Find next question that isn't skipped
  for (let i = currentIndex + 1; i < allQuestions.length; i++) {
    const question = allQuestions[i]

    // Check if this question should be skipped
    if (question.skipCondition && question.skipCondition(answers)) {
      continue
    }

    return question
  }

  return null
}

/**
 * Get previous question based on current answers and skip logic
 */
export function getPreviousQuestion(
  currentQuestionId: string,
  answers: Record<string, any>
): SurveyQuestion | null {
  const allQuestions = getAllQuestions()
  const currentIndex = allQuestions.findIndex(q => q.id === currentQuestionId)

  if (currentIndex <= 0) {
    return null
  }

  // Find previous question that isn't skipped
  for (let i = currentIndex - 1; i >= 0; i--) {
    const question = allQuestions[i]

    // Check if this question should be skipped
    if (question.skipCondition && question.skipCondition(answers)) {
      continue
    }

    return question
  }

  return null
}

/**
 * Get active questions (not skipped) based on current answers
 */
export function getActiveQuestions(answers: Record<string, any>): SurveyQuestion[] {
  return getAllQuestions().filter(question => {
    if (question.skipCondition && question.skipCondition(answers)) {
      return false
    }
    return true
  })
}