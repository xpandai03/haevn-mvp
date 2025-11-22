import { DisplayCondition, parseDisplayLogic } from './logic-parser'
import { evaluateDisplayLogic } from './logic-evaluator'

export interface SurveyQuestion {
  id: string
  csvId?: string // CSV Question ID (e.g., Q1, Q2, Q3a)
  label: string
  type: 'select' | 'multiselect' | 'text' | 'textarea' | 'scale' | 'boolean' | 'number' | 'slider' | 'date'
  options?: string[]
  placeholder?: string
  required: boolean
  skipCondition?: (answers: Record<string, any>) => boolean
  displayLogic?: string // Raw Display Logic from CSV
  displayCondition?: DisplayCondition | null // Parsed Display Logic condition
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
    description: "Let's start with some basic information about you",
    questions: [
      {
        id: 'q1_age',
        csvId: 'Q1',
        label: 'What is your birthdate?',
        type: 'date',
        placeholder: 'MM/DD/YYYY',
        required: true,
        helperText: "We use your birthdate only to confirm you're 18+ and to help match people in similar life stages."
      },
      {
        id: 'q2_gender_identity',
        csvId: 'Q2',
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
        csvId: 'Q2a',
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
        csvId: 'Q3',
        label: 'Sexual orientation',
        type: 'select',
        options: [
          'Straight',
          'Gay/Lesbian',
          'Bisexual',
          'Pansexual',
          'Queer',
          'Fluid',
          'Asexual',
          'Demisexual',
          'Questioning/Unsure',
          'Prefer not to say',
          'Other'
        ],
        required: true,
        helperText: 'Choose the orientation that best describes you.'
      },
      {
        id: 'q3a_fidelity',
        csvId: 'Q3a',
        label: 'How do you define fidelity or commitment?',
        type: 'textarea',
        placeholder: 'Share your thoughts on commitment...',
        required: false,
        helperText: "Everyone defines commitment differently. There's no right answer — just yours."
        // displayLogic removed - always shown per Rick's guidance (branching starts in Relationship Preferences)
      },
      {
        id: 'q3b_kinsey_scale',
        csvId: 'Q3b',
        label: 'Where do you land on the Kinsey Scale?',
        type: 'select',
        required: false,
        helperText: 'The Kinsey Scale measures sexual orientation as a spectrum. Choose the option that best describes you.',
        options: [
          '0 - Exclusively heterosexual',
          '1 - Predominantly heterosexual, only incidentally homosexual',
          '2 - Predominantly heterosexual, but more than incidentally homosexual',
          '3 - Equally heterosexual and homosexual (bisexual)',
          '4 - Predominantly homosexual, but more than incidentally heterosexual',
          '5 - Predominantly homosexual, only incidentally heterosexual',
          '6 - Exclusively homosexual'
        ]
        // displayLogic removed - always shown per Master CSV (no conditions in Basic Info)
      },
      {
        id: 'q3c_partner_kinsey_preference',
        csvId: 'Q3c',
        label: 'Do you prefer partners with a particular Kinsey scale position?',
        type: 'multiselect',
        required: false,
        helperText: 'Select all that apply. Leave blank if you have no preference.',
        options: [
          '0 - Exclusively heterosexual',
          '1 - Predominantly heterosexual, only incidentally homosexual',
          '2 - Predominantly heterosexual, but more than incidentally homosexual',
          '3 - Equally heterosexual and homosexual (bisexual)',
          '4 - Predominantly homosexual, but more than incidentally heterosexual',
          '5 - Predominantly homosexual, only incidentally heterosexual',
          '6 - Exclusively homosexual',
          'No preference'
        ]
        // displayLogic removed - always shown per Master CSV (no conditions in Basic Info)
      },
      {
        id: 'q4_relationship_status',
        csvId: 'Q4',
        label: "What's your current relationship status?",
        type: 'select',
        options: [
          'Single',
          'Dating',
          'Married',
          'Partnered',
          'Couple',
          'In a polycule',
          'Solo Poly',
          'Exploring',
          'Prefer not to say'
        ],
        required: true,
        helperText: 'Choose the status that best describes your current situation.'
      }
      // Removed q5_zip_code and q5a_precise_location - already collected during signup
    ]
  },
  {
    id: 'relationship_preferences',
    title: 'Relationship Preferences',
    description: "Help us understand what you're looking for",
    questions: [
      {
        id: 'q6_relationship_styles',
        csvId: 'Q6',
        label: 'What relationship style(s) interest you?',
        type: 'select',
        options: [
          'Monogamous',
          'Monogamish',
          'ENM',
          'Polyamorous',
          'Open',
          'Exploring'
        ],
        required: true,
        helperText: 'Choose the relationship orientation that best describes you.'
      },
      {
        id: 'q6a_connection_type',
        csvId: 'Q6a',
        label: 'How would you like to meet people here?',
        type: 'multiselect',
        options: [
          'As an individual',
          'As a couple',
          'As part of a polycule/pod',
          'Open to any'
        ],
        required: true,
        helperText: 'Dating, friendship, play partners, community events, etc.'
      },
      {
        id: 'q6b_who_to_meet',
        csvId: 'Q6b',
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
        csvId: 'Q6c',
        label: 'How do you connect as a couple?',
        type: 'select',
        options: [
          'Together only',
          'Either partner solo',
          'Mix together + solo',
          'Custom / differs by partner'
        ],
        required: false,
        helperText: 'E.g., meet singles together, meet other couples, etc.',
        displayLogic: "Q4 in {Dating,Married,Partnered,Couple}"
      },
      {
        id: 'q6d_couple_permissions',
        csvId: 'Q6d',
        label: 'Tell us more about your couple structure',
        type: 'textarea',
        placeholder: 'Describe your agreements...',
        required: false,
        helperText: 'Help people understand how you connect. For example: do you date together? separately? both? with veto power? without? Are there people each of you date independently?',
        displayLogic: "Show if Q6c='Custom / differs by partner'"
      },
      {
        id: 'q7_emotional_exclusivity',
        csvId: 'Q7',
        label: 'How important is emotional exclusivity to you?',
        type: 'slider',
        required: true,
        helperText: "This means sharing deep romantic feelings with only one person. Some people want this, some don't—both are valid.",
        min: 1,
        max: 10,
        step: 1,
        displayLogic: "Q6 in {Monogamish,Open,Polyamorous,Exploring}"
      },
      {
        id: 'q8_sexual_exclusivity',
        csvId: 'Q8',
        label: 'How important is sexual exclusivity to you?',
        type: 'slider',
        required: true,
        helperText: 'This means sexual activity with only one person. No judgment—just clarity.',
        min: 1,
        max: 10,
        step: 1,
        displayLogic: "Q6 in {Monogamish,Open,Polyamorous,Exploring}"
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
        csvId: 'Q10',
        label: 'Which attachment style best describes you?',
        type: 'select',
        options: [
          "Secure - I'm comfortable with intimacy and independence",
          'Anxious - I crave closeness but worry about relationships',
          'Avoidant - I value independence over intimacy',
          'Disorganized - I have mixed feelings about relationships',
          "Not sure - I'd like to learn more"
        ],
        required: true,
        helperText: "Not sure? [link to quick guide], it's about how you bond and communicate.",
        displayLogic: "Q4='Single' AND Q6 in {Monogamous,Monogamish,Polyamorous} OR Q4 in {Dating,Married,Partnered,Couple} AND Q6='Polyamorous'"
      },
      {
        id: 'q10a_emotional_availability',
        label: 'How emotionally available are you right now?',
        type: 'slider',
        required: true,
        helperText: "This is about your bandwidth—not your worth. We're asking where you're at emotionally right now, with no judgment.",
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
        helperText: 'How do you like to give and receive love? Pick all that resonate.'
      },
      {
        id: 'q12_conflict_resolution',
        csvId: 'Q12',
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
        helperText: 'Helps others understand your style when things get tense.',
        displayLogic: "Q4='Single' AND Q6 in {Monogamous,Monogamish,Polyamorous} OR Q4 in {Dating,Married,Partnered,Couple} AND Q6='Polyamorous'"
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
          "Unlimited - I'm very available",
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
          'Walk or coffee',
          'Drinks',
          'Dinner',
          'An activity or event',
          'Video call first',
          'Group setting',
          "I'm flexible"
        ],
        required: true,
        helperText: 'Coffee, video call, group event, etc.'
      },
      // Q17, Q17a, Q17b - Hidden for MVP (NOT MVP per Conditional Branching CSV)
      // {
      //   id: 'q17_children',
      //   csvId: 'Q17',
      //   label: 'Do you have or want children?',
      //   type: 'select',
      //   options: [
      //     'Have children',
      //     'Want children',
      //     'Have and want more',
      //     "Don't have, don't want",
      //     'Not sure',
      //     'Prefer not to say'
      //   ],
      //   required: false,
      //   helperText: 'Optional - Include any important notes (e.g., "don\'t want more").'
      // },
      // {
      //   id: 'q17a_dietary',
      //   csvId: 'Q17a',
      //   label: 'Any dietary preferences or allergies?',
      //   type: 'text',
      //   placeholder: 'e.g., Vegan, gluten-free, nut allergy',
      //   required: false,
      //   helperText: 'Optional - Helpful for planning dates or events.'
      // },
      // {
      //   id: 'q17b_pets',
      //   csvId: 'Q17b',
      //   label: 'Pets at home or pet preferences?',
      //   type: 'text',
      //   placeholder: 'e.g., Have cats, allergic to dogs',
      //   required: false,
      //   helperText: 'Optional - Include allergies or must-love-dogs type info.'
      // },
      {
        id: 'q18_substances',
        label: 'How do you relate to alcohol or other substances?',
        type: 'multiselect',
        options: [
          'Sober',
          'Social drinker',
          'Regular user',
          'Cannabis user',
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
        label: "What's the farthest distance you'd consider for connection?",
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
        helperText: 'Some folks need full discretion. Others are open. Neither is wrong—we just want to match you with people on the same page.',
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
        type: 'select',
        options: [
          'Sexual chemistry matters most',
          'Both are equally important',
          'Emotional connection matters most'
        ],
        required: true,
        helperText: 'Slider or scale works well here.'
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
        type: 'textarea',
        placeholder: 'List any activities you never want to engage in...',
        required: false,
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
    description: "Tell us more about what you're looking for",
    questions: [
      {
        id: 'q32_looking_for',
        label: "Tell us about yourself and what you're looking for",
        type: 'textarea',
        placeholder: 'Share your authentic desires and intentions...',
        required: true,
        helperText: 'Anything from one line to a short paragraph.'
      },
      {
        id: 'q33_kinks',
        csvId: 'Q33',
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
          'Primal play',
          'Age play',
          'Pet play',
          'Rope play',
          'Wax play',
          'Temperature play',
          'Orgasm control',
          'Edging',
          'Praise kink',
          'Degradation',
          'Humiliation',
          'Cuckolding/hotwifing',
          'Feet',
          'Latex/leather',
          'None',
          'Prefer not to say',
          'Still exploring'
        ],
        required: false,
        helperText: 'Select any that apply.'
      },
      {
        id: 'q33a_experience_level',
        csvId: 'Q33a',
        label: "What's your experience level with those kinks?",
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
        displayLogic: 'Show if Q33 answered'
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
        label: "I'm drawn to variety and creativity in intimacy.",
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
        label: "In new situations, I'm usually outgoing and expressive.",
        type: 'slider',
        required: true,
        helperText: '',
        min: 1,
        max: 10,
        step: 1
      },
      {
        id: 'q37_empathy',
        label: "I'm empathetic and attuned to my partner's needs.",
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

  // Build a CSV-ID-keyed answer map for logic evaluation
  const csvAnswers = buildCsvAnswerMap(answers)

  surveySections.forEach(section => {
    section.questions.forEach(question => {
      // Check legacy skipCondition first (backward compatibility)
      if (question.skipCondition && question.skipCondition(answers)) {
        return
      }

      // Check new displayLogic system
      if (question.displayLogic) {
        // Parse display logic if not already parsed
        if (!question.displayCondition) {
          question.displayCondition = parseDisplayLogic(question.displayLogic)
        }

        // Evaluate the condition
        if (!evaluateDisplayLogic(question.displayCondition, csvAnswers)) {
          return
        }
      }

      activeQuestions.push(question)
    })
  })

  return activeQuestions
}

/**
 * Build a map of answers keyed by CSV question IDs for logic evaluation
 */
function buildCsvAnswerMap(answers: Record<string, any>): Record<string, any> {
  const csvAnswers: Record<string, any> = {}

  surveySections.forEach(section => {
    section.questions.forEach(question => {
      if (question.csvId && answers[question.id] !== undefined) {
        csvAnswers[question.csvId] = answers[question.id]
      }
    })
  })

  return csvAnswers
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