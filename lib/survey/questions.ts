export interface SurveyQuestion {
  id: string
  label: string
  type: 'select' | 'multiselect' | 'text' | 'textarea' | 'scale' | 'boolean' | 'number' | 'slider'
  options?: string[]
  placeholder?: string
  required: boolean
  skipCondition?: (answers: Record<string, any>) => boolean
  tooltip?: string
  helperText?: string
  min?: number
  max?: number
  step?: number
}

export interface SurveySection {
  id: string
  title: string
  description?: string
  questions: SurveyQuestion[]
}

export const surveySections: SurveySection[] = [
  {
    id: 'basic_demographics',
    title: 'Basic Information',
    description: 'Let\'s start with some basic information about you',
    questions: [
      {
        id: 'q1_age',
        label: 'How old are you?',
        type: 'number',
        placeholder: 'Enter your age',
        required: true,
        helperText: 'We use age only to confirm you\'re 18+ and to help match people in similar life stages.',
        min: 18,
        max: 120
      },
      {
        id: 'q2_gender_identity',
        label: 'How do you describe your gender identity?',
        type: 'select',
        options: [
          'Man',
          'Woman',
          'Non-binary',
          'Trans man',
          'Trans woman',
          'Genderfluid',
          'Agender',
          'Two-Spirit',
          'Other (please specify)'
        ],
        required: true,
        helperText: 'Choose the term that feels right for you. You can type your own if none fit.'
      },
      {
        id: 'q2a_pronouns',
        label: 'Which pronouns do you want others to use for you?',
        type: 'select',
        options: [
          'she/her',
          'he/him',
          'they/them',
          'she/they',
          'he/they',
          'ze/zir',
          'xe/xem',
          'Other (please specify)'
        ],
        placeholder: 'Select or enter custom pronouns',
        required: true,
        helperText: 'Examples: she/her, he/him, they/them, or a custom set.'
      },
      {
        id: 'q3_sexual_orientation',
        label: 'How do you describe your sexual orientation?',
        type: 'multiselect',
        options: [
          'Straight/Heterosexual',
          'Gay',
          'Lesbian',
          'Bisexual',
          'Pansexual',
          'Asexual',
          'Demisexual',
          'Queer',
          'Questioning',
          'Other'
        ],
        required: true,
        helperText: 'Pick the label(s) that best fit you, use "other" or write your own if needed.'
      },
      {
        id: 'q3a_fidelity',
        label: 'How do you define fidelity or commitment?',
        type: 'textarea',
        placeholder: 'Share your thoughts on commitment...',
        required: false,
        helperText: 'People define commitment differently (monogamy, openness, etc.). Tell us what it means to you.'
      },
      {
        id: 'q3b_kinsey_scale',
        label: 'Where do you land on the Kinsey Scale (0–6)?',
        type: 'slider',
        required: false,
        helperText: '0 = exclusively straight, 6 = exclusively gay/queer. It\'s a spectrum, not a box.',
        min: 0,
        max: 6,
        step: 1
      },
      {
        id: 'q3c_partner_kinsey_preference',
        label: 'Do you prefer partners with a particular Kinsey-scale range?',
        type: 'text',
        placeholder: 'e.g., 2-4, or no preference',
        required: false,
        helperText: 'Only answer if you have a preference; many people don\'t.',
        skipCondition: (answers) => !answers.q3b_kinsey_scale && answers.q3b_kinsey_scale !== 0
      },
      {
        id: 'q4_relationship_status',
        label: 'What\'s your current relationship status?',
        type: 'select',
        options: [
          'Single',
          'Partnered',
          'Married',
          'In a polycule',
          'It\'s complicated',
          'Other'
        ],
        required: true,
        helperText: 'Examples: single, partnered, married, polycule, etc.'
      },
      {
        id: 'q5_zip_code',
        label: 'What\'s your ZIP code?',
        type: 'text',
        placeholder: 'Enter ZIP code',
        required: true,
        helperText: 'This helps us show you people nearby.'
      },
      {
        id: 'q5a_precise_location',
        label: 'Share precise location?',
        type: 'select',
        options: ['Yes', 'No', 'Ask me later'],
        required: false,
        helperText: 'Optional. Improves distance matching but not required.'
      }
    ]
  },
  {
    id: 'relationship_preferences',
    title: 'Relationship Preferences',
    description: 'Help us understand what you\'re looking for',
    questions: [
      {
        id: 'q6_relationship_styles',
        label: 'What relationship style(s) interest you?',
        type: 'multiselect',
        options: [
          'Monogamy',
          'Open relationship',
          'Polyamory',
          'Relationship anarchy',
          'Swinging',
          'Don\'t know yet',
          'Other'
        ],
        required: true,
        helperText: 'Monogamy, open, polyamory, etc. Select all that apply.'
      },
      {
        id: 'q6a_connection_type',
        label: 'How would you like to meet people here?',
        type: 'multiselect',
        options: [
          'Dating',
          'Friendship',
          'Play partners',
          'Community events',
          'Learning/workshops',
          'Support groups'
        ],
        required: true,
        helperText: 'Dating, friendship, play partners, community events, etc.'
      },
      {
        id: 'q6b_who_to_meet',
        label: 'Who are you hoping to meet?',
        type: 'multiselect',
        options: [
          'Individuals',
          'Couples',
          'People of any gender',
          'People of specific genders',
          'Groups/communities'
        ],
        required: true,
        helperText: 'Individuals, couples, specific genders, etc.'
      },
      {
        id: 'q6c_couple_connection',
        label: 'If you\'re a couple, how do you want to connect?',
        type: 'multiselect',
        options: [
          'Meet singles together',
          'Meet other couples',
          'Separate connections okay',
          'Together only',
          'Flexible'
        ],
        required: false,
        helperText: 'E.g., meet singles together, meet other couples, etc.',
        skipCondition: (answers) => !['Partnered', 'Married', 'In a polycule'].includes(answers.q4_relationship_status)
      },
      {
        id: 'q6d_couple_permissions',
        label: 'What boundaries or permissions apply to you as a couple?',
        type: 'textarea',
        placeholder: 'Describe your agreements...',
        required: false,
        helperText: 'Briefly describe any agreements partners should know.',
        skipCondition: (answers) => !['Partnered', 'Married', 'In a polycule'].includes(answers.q4_relationship_status)
      },
      {
        id: 'q7_emotional_exclusivity',
        label: 'How important is emotional exclusivity to you?',
        type: 'slider',
        required: true,
        helperText: 'Emotional exclusivity means sharing deep romantic feelings with only one person.',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q8_sexual_exclusivity',
        label: 'How important is sexual exclusivity to you?',
        type: 'slider',
        required: true,
        helperText: 'Sexual exclusivity means sexual activity with only one person.',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q9_intentions',
        label: 'What are you looking for? (select all)',
        type: 'multiselect',
        options: [
          'Long-term partnership',
          'Casual dating',
          'Play partners',
          'Community',
          'Friendship',
          'Learning/exploration',
          'Not sure yet'
        ],
        required: true,
        helperText: 'Long-term partnership, casual dating, play partners, community, etc.'
      },
      {
        id: 'q9a_sex_or_more',
        label: 'Are you seeking only sexual connection, or more?',
        type: 'select',
        options: [
          'Only sexual',
          'Primarily sexual',
          'Both equally',
          'Primarily emotional',
          'Only emotional',
          'It depends'
        ],
        required: false,
        helperText: 'Optional; helps set expectations.'
      }
    ]
  },
  {
    id: 'communication_attachment',
    title: 'Communication & Connection',
    description: 'Your communication and attachment style',
    questions: [
      {
        id: 'q10_attachment_style',
        label: 'Which attachment style best describes you?',
        type: 'select',
        options: [
          'Secure - I\'m comfortable with intimacy and independence',
          'Anxious - I crave closeness but worry about relationships',
          'Avoidant - I value independence over intimacy',
          'Disorganized - I have mixed feelings about relationships',
          'Not sure - I\'d like to learn more'
        ],
        required: true,
        helperText: 'Not sure? [link to quick guide], it\'s about how you bond and communicate.'
      },
      {
        id: 'q10a_emotional_availability',
        label: 'How emotionally available are you right now?',
        type: 'slider',
        required: true,
        helperText: 'Your capacity for a new connection, no judgment.',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q11_love_languages',
        label: 'What are your love languages?',
        type: 'multiselect',
        options: [
          'Words of affirmation',
          'Quality time',
          'Physical touch',
          'Acts of service',
          'Receiving gifts'
        ],
        required: true,
        helperText: 'Words of affirmation, quality time, etc. Choose any that fit.'
      },
      {
        id: 'q12_conflict_resolution',
        label: 'How do you typically handle conflict?',
        type: 'select',
        options: [
          'Address immediately and directly',
          'Take time to cool down first',
          'Seek mediation or help',
          'Avoid if possible',
          'It depends on the situation'
        ],
        required: true,
        helperText: 'Helps others understand your style when things get tense.'
      },
      {
        id: 'q12a_messaging_pace',
        label: 'What messaging pace feels right?',
        type: 'select',
        options: [
          'Constant communication',
          'Multiple times daily',
          'Once a day',
          'Every few days',
          'Only when meeting in person',
          'Flexible'
        ],
        required: true,
        helperText: 'Fast replies, once a day, only when meeting in person, etc.'
      }
    ]
  },
  {
    id: 'lifestyle_values',
    title: 'Lifestyle & Values',
    description: 'Your lifestyle, availability, and what matters to you',
    questions: [
      {
        id: 'q13_lifestyle_alignment',
        label: 'How important is lifestyle alignment?',
        type: 'slider',
        required: true,
        helperText: 'Schedule, habits, priorities, does it matter if they match yours?',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q13a_languages',
        label: 'Which languages do you speak comfortably?',
        type: 'text',
        placeholder: 'e.g., English, Spanish, ASL',
        required: false,
        helperText: 'List all that feel natural for you.'
      },
      {
        id: 'q14a_cultural_alignment',
        label: 'How important is shared cultural or worldview alignment?',
        type: 'slider',
        required: false,
        helperText: 'Religion, politics, traditions, etc. If it matters, say so.',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q14b_cultural_identity',
        label: 'How do you describe your cultural or political identity?',
        type: 'textarea',
        placeholder: 'Share your perspective...',
        required: false,
        helperText: 'Optional - helps others understand your perspective.'
      },
      {
        id: 'q15_time_availability',
        label: 'How much time can you realistically give new relationships?',
        type: 'select',
        options: [
          'Unlimited - I\'m very available',
          'Several days a week',
          'Once or twice a week',
          'A few times a month',
          'Once a month or less',
          'It varies greatly'
        ],
        required: true,
        helperText: 'A rough idea helps set expectations.'
      },
      {
        id: 'q16_typical_availability',
        label: 'When are you usually available to connect?',
        type: 'multiselect',
        options: [
          'Weekday mornings',
          'Weekday afternoons',
          'Weekday evenings',
          'Weekends',
          'Late nights',
          'Flexible/varies'
        ],
        required: true,
        helperText: 'Evenings, weekends, flexible, etc.'
      },
      {
        id: 'q16a_first_meet_preference',
        label: 'How do you like to meet for the first time?',
        type: 'select',
        options: [
          'Coffee or tea',
          'Drinks',
          'Meal',
          'Activity or event',
          'Video call first',
          'Group event',
          'Flexible'
        ],
        required: true,
        helperText: 'Coffee, video call, group event, etc.'
      },
      {
        id: 'q17_children',
        label: 'Do you have or want children?',
        type: 'select',
        options: [
          'Have children',
          'Want children',
          'Have and want more',
          'Don\'t have, don\'t want',
          'Not sure',
          'Prefer not to say'
        ],
        required: false,
        helperText: 'Optional - Include any important notes (e.g., "don\'t want more").'
      },
      {
        id: 'q17a_dietary',
        label: 'Any dietary preferences or allergies?',
        type: 'text',
        placeholder: 'e.g., Vegan, gluten-free, nut allergy',
        required: false,
        helperText: 'Optional - Helpful for planning dates or events.'
      },
      {
        id: 'q17b_pets',
        label: 'Pets at home or pet preferences?',
        type: 'text',
        placeholder: 'e.g., Have cats, allergic to dogs',
        required: false,
        helperText: 'Optional - Include allergies or must-love-dogs type info.'
      },
      {
        id: 'q18_substances',
        label: 'How do you relate to alcohol or other substances?',
        type: 'select',
        options: [
          'Sober',
          'Social drinker',
          'Regular drinker',
          'Cannabis-friendly',
          '420 friendly',
          'Sober curious',
          'In recovery',
          'Prefer not to say'
        ],
        required: true,
        helperText: 'Social drinker, sober, cannabis-friendly, etc.'
      },
      {
        id: 'q19a_max_distance',
        label: 'What\'s the farthest distance you\'d consider for connection?',
        type: 'select',
        options: [
          'My neighborhood only',
          'Within 10 miles',
          'Within 25 miles',
          'Within 50 miles',
          'Within 100 miles',
          'Any distance'
        ],
        required: true,
        helperText: 'Miles or kilometers.'
      },
      {
        id: 'q19b_distance_priority',
        label: 'Should distance affect matching priority?',
        type: 'select',
        options: [
          'Yes, closer is better',
          'Somewhat important',
          'Not important',
          'Prefer longer distance'
        ],
        required: false,
        helperText: 'e.g., closer matches show first.'
      },
      {
        id: 'q19c_mobility',
        label: 'How mobile are you?',
        type: 'select',
        options: [
          'Very mobile - travel frequently',
          'Somewhat mobile - can travel occasionally',
          'Limited mobility - prefer local',
          'Remote worker - location flexible',
          'It varies'
        ],
        required: false,
        helperText: 'Frequent traveler, remote worker, etc.'
      }
    ]
  },
  {
    id: 'privacy_community',
    title: 'Privacy & Community',
    description: 'Your privacy needs and community involvement',
    questions: [
      {
        id: 'q20_discretion',
        label: 'How important is privacy/discretion?',
        type: 'slider',
        required: true,
        helperText: 'Helps match with people who share your privacy needs.',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q20a_photo_sharing',
        label: 'Are you comfortable sharing photos early on?',
        type: 'select',
        options: [
          'Yes, immediately',
          'After chatting',
          'After meeting',
          'Very selective',
          'No photos'
        ],
        required: false,
        helperText: 'Optional and private.'
      },
      {
        id: 'q20b_how_out',
        label: 'How public are you about your relationship style or erotic life?',
        type: 'select',
        options: [
          'Completely private',
          'Close friends only',
          'Most people know',
          'Fully open',
          'It depends on context'
        ],
        required: true,
        helperText: 'From completely private to fully open.'
      },
      {
        id: 'q21_platform_use',
        label: 'How do you see yourself using HAEVN? (select all)',
        type: 'multiselect',
        options: [
          'Dating',
          'Learning',
          'Events',
          'Community',
          'Support',
          'Exploration',
          'Not sure yet'
        ],
        required: true,
        helperText: 'Dating, learning, events, community, etc.'
      },
      {
        id: 'q22_spirituality_sexuality',
        label: 'Do you connect intimacy or sexuality with spirituality or personal growth?',
        type: 'select',
        options: [
          'Yes, deeply connected',
          'Somewhat connected',
          'Not connected',
          'Curious to explore',
          'Not sure'
        ],
        required: false,
        helperText: 'Share your perspective, no right answer.'
      }
    ]
  },
  {
    id: 'intimacy_sexuality',
    title: 'Intimacy & Sexuality',
    description: 'Your approach to physical and erotic connection',
    questions: [
      {
        id: 'q23_erotic_styles',
        label: 'Which erotic styles resonate with you?',
        type: 'multiselect',
        options: [
          'Sensual',
          'Playful',
          'Romantic',
          'Kinky',
          'Vanilla',
          'Experimental',
          'Tantric',
          'Primal',
          'Still exploring'
        ],
        required: true,
        helperText: 'Sensual, playful, kinky, etc. Choose all that fit.'
      },
      {
        id: 'q24_experiences',
        label: 'Which experiences interest you?',
        type: 'multiselect',
        options: [
          'Private encounters',
          'Play parties',
          'Workshops',
          'Retreats',
          'Online exploration',
          'Group dynamics',
          'One-on-one only'
        ],
        required: true,
        helperText: 'Parties, workshops, private encounters, etc.'
      },
      {
        id: 'q25_chemistry_vs_emotion',
        label: 'How important is sexual chemistry compared to emotional connection?',
        type: 'slider',
        required: true,
        helperText: 'Slider or scale works well here.',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q25a_frequency',
        label: 'Ideally, how often do you want erotic/sexual connection?',
        type: 'select',
        options: [
          'Daily',
          'Several times a week',
          'Weekly',
          'A few times a month',
          'Monthly',
          'Occasionally',
          'Rarely',
          'It varies'
        ],
        required: false,
        helperText: 'Ballpark is fine.'
      },
      {
        id: 'q26_roles',
        label: 'Which sexual or relational roles interest you?',
        type: 'multiselect',
        options: [
          'Top',
          'Bottom',
          'Verse/Switch',
          'Dominant',
          'Submissive',
          'Service-oriented',
          'Nurturing',
          'None/Vanilla',
          'Exploring'
        ],
        required: false,
        helperText: 'Top/bottom/verse, dominant/submissive, etc.'
      },
      {
        id: 'q27_physical_preferences',
        label: 'Any body or physical preferences?',
        type: 'text',
        placeholder: 'Optional - be respectful',
        required: false,
        helperText: 'Optional - helps with mutual attraction.'
      },
      {
        id: 'q28_hard_boundaries',
        label: 'What are your absolute boundaries?',
        type: 'multiselect',
        options: [
          'No pain',
          'No marks',
          'No photos/video',
          'No group play',
          'No substances',
          'No roleplay',
          'No power exchange',
          'Other (specify in notes)'
        ],
        required: true,
        helperText: 'Activities you never want to engage in.'
      },
      {
        id: 'q29_maybe_boundaries',
        label: 'What activities intrigue you but need discussion first?',
        type: 'multiselect',
        options: [
          'Light bondage',
          'Role play',
          'Group dynamics',
          'Power exchange',
          'Impact play',
          'Exhibitionism',
          'New experiences',
          'Other (specify)'
        ],
        required: false,
        helperText: '"Maybe, with the right person."'
      },
      {
        id: 'q30_safer_sex',
        label: 'What are your safer-sex preferences?',
        type: 'multiselect',
        options: [
          'Barriers always',
          'Barriers with new partners',
          'Regular testing',
          'PrEP/PEP aware',
          'Fluid bonding with specific partners',
          'Discussion before intimacy',
          'Other'
        ],
        required: true,
        helperText: 'Condoms, testing frequency, etc.'
      },
      {
        id: 'q30a_fluid_bonding',
        label: 'Would you consider fluid bonding (sex without barriers)?',
        type: 'select',
        options: [
          'Yes, with the right person',
          'Maybe, needs discussion',
          'No',
          'Already fluid bonded',
          'Not sure what this means'
        ],
        required: false,
        helperText: 'Only answer if you know the term, info bubble explains risk and trust factors.'
      },
      {
        id: 'q31_health_testing',
        label: 'How do you handle sexual health and testing?',
        type: 'select',
        options: [
          'Test regularly (monthly)',
          'Test quarterly',
          'Test biannually',
          'Test annually',
          'Test before new partners',
          'Other approach'
        ],
        required: true,
        helperText: 'Frequency, recent tests, etc.'
      }
    ]
  },
  {
    id: 'personal_expression',
    title: 'Personal Expression',
    description: 'Tell us more about what you\'re looking for',
    questions: [
      {
        id: 'q32_looking_for',
        label: 'In your own words, what are you looking for here?',
        type: 'textarea',
        placeholder: 'Share your authentic desires and intentions...',
        required: true,
        helperText: 'Anything from one line to a short paragraph.'
      },
      {
        id: 'q32a_need_inspiration',
        label: 'Need inspiration?',
        type: 'select',
        options: [
          'Show me prompts',
          'I\'m good, thanks'
        ],
        required: false,
        helperText: 'We\'ll show sample prompts if you\'d like ideas.',
        skipCondition: (answers) => answers.q32_looking_for && answers.q32_looking_for.length > 20
      },
      {
        id: 'q33_kinks',
        label: 'Which kinks or fetishes interest you?',
        type: 'multiselect',
        options: [
          'Bondage',
          'Discipline',
          'Dominance/submission',
          'Sadism/masochism',
          'Role play',
          'Voyeurism',
          'Exhibitionism',
          'Impact play',
          'Sensory play',
          'None',
          'Prefer not to say',
          'Still exploring'
        ],
        required: false,
        helperText: 'Select any that apply.'
      },
      {
        id: 'q33a_experience_level',
        label: 'What\'s your experience level with those kinks?',
        type: 'select',
        options: [
          'Very experienced',
          'Some experience',
          'Curious beginner',
          'Just fantasies so far',
          'Not applicable'
        ],
        required: false,
        helperText: 'Beginner, curious, experienced, etc.',
        skipCondition: (answers) => !answers.q33_kinks || answers.q33_kinks.includes('None')
      }
    ]
  },
  {
    id: 'personality_insights',
    title: 'Personality Insights',
    description: 'Help others understand your personality and style',
    questions: [
      {
        id: 'q34_exploration',
        label: 'I enjoy exploring new erotic or relational experiences.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q34a_variety',
        label: 'I\'m drawn to variety and creativity in intimacy.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q35_agreements',
        label: 'I value clear agreements and follow through on commitments.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q35a_structure',
        label: 'I like erotic and relational experiences to have some structure.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q36_social_energy',
        label: 'I gain energy from social or erotic spaces.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q36a_outgoing',
        label: 'In new situations, I\'m usually outgoing and expressive.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q37_empathy',
        label: 'I\'m empathetic and attuned to my partner\'s needs.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q37a_harmony',
        label: 'I like finding harmony and avoiding unnecessary conflict.',
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q38_jealousy',
        label: 'I sometimes struggle with jealousy or insecurity in relationships.',
        type: 'slider',
        required: false,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q38a_emotional_reactive',
        label: 'I can be emotionally reactive in intimate or erotic situations.',
        type: 'slider',
        required: false,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
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

/**
 * Get the section for a given question
 */
export function getSectionForQuestion(questionId: string): SurveySection | undefined {
  return surveySections.find(section =>
    section.questions.some(q => q.id === questionId)
  )
}

/**
 * Get active questions within a specific section (respecting skip logic)
 */
export function getActiveQuestionsInSection(
  sectionId: string,
  answers: Record<string, any>
): SurveyQuestion[] {
  const section = surveySections.find(s => s.id === sectionId)
  if (!section) return []

  return section.questions.filter(question => {
    // Check if question should be skipped
    if (question.skipCondition && question.skipCondition(answers)) {
      return false
    }
    return true
  })
}

/**
 * Get the index of a question within its section (0-based)
 */
export function getQuestionIndexInSection(
  questionId: string,
  answers: Record<string, any>
): number {
  const section = getSectionForQuestion(questionId)
  if (!section) return 0

  const activeQuestions = getActiveQuestionsInSection(section.id, answers)
  return activeQuestions.findIndex(q => q.id === questionId)
}

/**
 * Check if a section is complete (all questions answered)
 */
export function isSectionComplete(
  sectionId: string,
  answers: Record<string, any>
): boolean {
  const activeQuestions = getActiveQuestionsInSection(sectionId, answers)

  return activeQuestions.every(question => {
    const answer = answers[question.id]
    if (Array.isArray(answer)) return answer.length > 0
    return answer !== undefined && answer !== null && answer !== ''
  })
}

/**
 * Get celebration message for a section
 */
export function getSectionCelebrationMessage(sectionIndex: number): string {
  const messages = [
    "Great start! 🎉",
    "You're doing amazing! 💫",
    "Keep going, you're a third of the way there! 💪",
    "Halfway there! You're crushing it! ⭐",
    "Almost done! Just 3 more sections! 🚀",
    "You're on a roll! 2 sections left! 🔥",
    "One more to go! You've got this! 🎯",
    "Survey Complete! Amazing work! 🎊"
  ]
  return messages[sectionIndex] || "Great job!"
}