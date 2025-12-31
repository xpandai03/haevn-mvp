/**
 * Populate survey answers for a test user
 * Usage: npx tsx scripts/populate-test-survey.ts <email>
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Generate reasonable test answers for all required questions
const testAnswers: Record<string, any> = {
  // Basic Demographics
  q1_age: '1990-05-15',
  q2_gender_identity: 'Man',
  q2a_pronouns: 'he/him',
  q3_sexual_orientation: 'Bisexual',
  q3a_fidelity: 'Open communication and honesty are key for me.',
  q3b_kinsey_scale: '3 - Equally heterosexual and homosexual (bisexual)',
  q3c_partner_kinsey_preference: ['No preference'],
  q4_relationship_status: 'Partnered',

  // Relationship Preferences
  q6_relationship_styles: ['ENM', 'Polyamorous'],
  q6a_connection_type: ['As an individual', 'As a couple'],
  q6b_who_to_meet: ['Individuals', 'Couples'],
  q6c_couple_connection: 'Mix together + solo',
  q7_emotional_exclusivity: 5,
  q8_sexual_exclusivity: 4,
  q9_intentions: ['Long-term partnership', 'Community', 'Friendship'],
  q9a_sex_or_more: 'Both equally',
  q9b_dating_readiness: "Dating & Relationships — I'm open and ready to connect.",

  // Communication & Connection
  q10_attachment_style: "Secure - I'm comfortable with intimacy and independence",
  q10a_emotional_availability: 7,
  q11_love_languages: ['Quality time', 'Physical touch', 'Words of affirmation'],
  q12_conflict_resolution: 'Address immediately and directly',
  q12a_messaging_pace: 'Once a day',

  // Lifestyle & Values
  q13_lifestyle_alignment: 6,
  q13a_languages: 'English',
  q14a_cultural_alignment: 5,
  q14b_cultural_identity: 'Progressive, open-minded.',
  q15_time_availability: 'Once or twice a week',
  q16_typical_availability: ['Weekday evenings', 'Weekends'],
  q16a_first_meet_preference: 'Walk or coffee',
  q18_substances: ['Social drinker', '420 friendly'],
  q19a_max_distance: 'Within 25 miles',
  q19b_distance_priority: 'Somewhat important',
  q19c_mobility: 'Somewhat mobile - can travel occasionally',

  // Privacy & Community
  q20_discretion: 6,
  q20a_photo_sharing: 'After chatting',
  q20b_how_out: 'Close friends only',
  q21_platform_use: ['Dating', 'Community', 'Exploration'],
  q22_spirituality_sexuality: 'Somewhat connected',

  // Intimacy & Sexuality
  q23_erotic_styles: ['Sensual', 'Playful', 'Romantic'],
  q24_experiences: ['Private encounters', 'Workshops'],
  q25_chemistry_vs_emotion: 'Both are equally important',
  q25a_frequency: 'Several times a week',
  q26_roles: ['Verse/Switch'],
  q27_body_type_self: 'Athletic / fit',
  q27_body_type_preferences: ['Athletic / fit', 'Average build', 'Curvy / soft'],
  q30_safer_sex: ['Regular testing', 'Discussion before intimacy'],
  q30a_fluid_bonding: 'Yes, with the right person',
  q31_health_testing: 'Test quarterly',

  // Personal Expression
  q32_looking_for: 'Looking for genuine connections with like-minded people who value open communication, respect, and fun. Interested in building meaningful relationships.',
  q33_kinks: ['Sensory play', 'Role play', 'Still exploring'],
  q33a_experience_level: 'Some experience',

  // Personality Insights
  q34_exploration: 7,
  q34a_variety: 6,
  q35_agreements: 8,
  q35a_structure: 5,
  q36_social_energy: 6,
  q36a_outgoing: 7,
  q37_empathy: 8,
  q37a_harmony: 7,
  q38_jealousy: 3,
  q38a_emotional_reactive: 4
}

async function populateSurvey(email: string) {
  console.log(`\n🔍 Looking up user: ${email}`)

  // 1. Find user by email
  const { data: userData, error: userError } = await supabase.auth.admin.listUsers()

  if (userError) {
    console.error('❌ Error listing users:', userError)
    return
  }

  const user = userData.users.find(u => u.email === email)
  if (!user) {
    console.error(`❌ User not found: ${email}`)
    return
  }

  console.log(`✅ Found user: ${user.id}`)

  // 2. Find their partnership
  const { data: membership, error: membershipError } = await supabase
    .from('partnership_members')
    .select('partnership_id')
    .eq('user_id', user.id)
    .single()

  if (membershipError || !membership) {
    console.error('❌ No partnership found for user')
    console.log('Creating a new partnership...')

    // Create partnership
    const { data: newPartnership, error: createError } = await supabase
      .from('partnerships')
      .insert({
        owner_id: user.id,
        profile_type: 'solo',
        membership_tier: 'pro',
        profile_state: 'draft',
        city: 'San Francisco',
        display_name: 'Test User'
      })
      .select()
      .single()

    if (createError || !newPartnership) {
      console.error('❌ Failed to create partnership:', createError)
      return
    }

    // Add as member
    await supabase
      .from('partnership_members')
      .insert({
        partnership_id: newPartnership.id,
        user_id: user.id,
        role: 'owner'
      })

    console.log(`✅ Created partnership: ${newPartnership.id}`)

    // Use the new partnership
    await insertSurvey(newPartnership.id, user.id)
  } else {
    console.log(`✅ Found partnership: ${membership.partnership_id}`)
    await insertSurvey(membership.partnership_id, user.id)
  }
}

async function insertSurvey(partnershipId: string, userId: string) {
  // 3. Check if survey exists (by user_id which is the primary key)
  const { data: existing } = await supabase
    .from('user_survey_responses')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  const surveyData = {
    answers_json: testAnswers,
    completion_pct: 100,
    current_step: 0,
    partnership_id: partnershipId,
    completed_sections: [
      'basic_demographics',
      'relationship_preferences',
      'communication_attachment',
      'lifestyle_values',
      'privacy_community',
      'intimacy_sexuality',
      'personal_expression',
      'personality_insights'
    ]
  }

  let surveyError;
  if (existing) {
    // Update existing
    console.log('📝 Updating existing survey...')
    const { error } = await supabase
      .from('user_survey_responses')
      .update(surveyData)
      .eq('user_id', userId)
    surveyError = error
  } else {
    // Insert new
    console.log('📝 Creating new survey...')
    const { error } = await supabase
      .from('user_survey_responses')
      .insert({
        user_id: userId,
        ...surveyData
      })
    surveyError = error
  }

  if (surveyError) {
    console.error('❌ Error saving survey:', surveyError)
    return
  }

  console.log(`✅ Survey populated with ${Object.keys(testAnswers).length} answers`)
  console.log(`✅ Completion: 100%`)

  // 4. Mark survey as reviewed for the user
  await supabase
    .from('partnership_members')
    .update({
      survey_reviewed: true,
      survey_reviewed_at: new Date().toISOString()
    })
    .eq('user_id', userId)
    .eq('partnership_id', partnershipId)

  console.log(`✅ Marked survey as reviewed`)

  // 5. Update profile
  await supabase
    .from('profiles')
    .update({ survey_complete: true })
    .eq('user_id', userId)

  console.log(`✅ Profile marked as survey complete`)
  console.log(`\n🎉 Done! User can now access dashboard and matching.`)
}

// Run
const email = process.argv[2] || 'raunek@xpandai.com'
populateSurvey(email)
