export const surveySteps = [
  {
    id: 'identity',
    title: 'Identity',
    questions: [
      {
        id: 'gender',
        label: 'How do you identify?',
        type: 'select',
        options: ['Male', 'Female', 'Non-binary', 'Prefer not to say'],
        required: true
      },
      {
        id: 'orientation',
        label: 'Sexual orientation',
        type: 'select',
        options: ['Straight', 'Gay', 'Lesbian', 'Bisexual', 'Pansexual', 'Other'],
        required: true
      },
      {
        id: 'relationship_type',
        label: 'What type of relationship are you seeking?',
        type: 'multiselect',
        options: ['Monogamous', 'Polyamorous', 'Open', 'Casual', 'Long-term'],
        required: true
      }
    ]
  },
  {
    id: 'intentions',
    title: 'Intentions',
    questions: [
      {
        id: 'looking_for',
        label: 'What are you looking for?',
        type: 'multiselect',
        options: ['Dating', 'Friendship', 'Casual encounters', 'Long-term relationship', 'Marriage'],
        required: true
      },
      {
        id: 'timeline',
        label: 'How soon are you looking to meet?',
        type: 'select',
        options: ['Immediately', 'Within a week', 'Within a month', 'No rush'],
        required: true
      }
    ]
  },
  {
    id: 'boundaries',
    title: 'Boundaries & Discretion',
    questions: [
      {
        id: 'privacy_level',
        label: 'Privacy preference',
        type: 'select',
        options: ['Very private', 'Somewhat private', 'Open', 'Flexible'],
        required: true
      },
      {
        id: 'photo_sharing',
        label: 'When do you want to share photos?',
        type: 'select',
        options: ['After handshake', 'After first message', 'After meeting in person', 'Never'],
        required: true
      }
    ]
  },
  {
    id: 'logistics',
    title: 'Logistics',
    questions: [
      {
        id: 'location_radius',
        label: 'How far are you willing to travel?',
        type: 'select',
        options: ['5 miles', '10 miles', '25 miles', '50 miles', 'Any distance'],
        required: true
      },
      {
        id: 'availability',
        label: 'When are you typically available?',
        type: 'multiselect',
        options: ['Weekday mornings', 'Weekday afternoons', 'Weekday evenings', 'Weekends'],
        required: true
      },
      {
        id: 'lifestyle',
        label: 'Your lifestyle',
        type: 'multiselect',
        options: ['Active', 'Social', 'Homebody', 'Traveler', 'Career-focused', 'Family-oriented'],
        required: true
      }
    ]
  }
]

export function calculateCompletion(responses: Record<string, any>): number {
  const totalQuestions = surveySteps.reduce((sum, step) => sum + step.questions.length, 0)
  const answeredQuestions = Object.keys(responses).length
  return Math.round((answeredQuestions / totalQuestions) * 100)
}