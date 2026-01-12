/**
 * Migration Script: Populate Partnership Fields from Survey Answers
 *
 * This script finds all partnerships with completed surveys (100% completion)
 * and populates the partnership profile fields (intentions, lifestyle_tags, etc.)
 * from their survey answers.
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-survey-to-partnership.ts
 * Or: npx tsx scripts/migrate-survey-to-partnership.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING')
  console.error('- SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'MISSING')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

/**
 * Extract profile fields from survey answers
 * Maps survey question answers to partnership table fields
 */
function extractProfileFieldsFromSurvey(answers: Record<string, any>): {
  short_bio: string | null
  intentions: string[]
  lifestyle_tags: string[]
  structure: { type: string; open_to?: string[] } | null
  orientation: { value: string; seeking?: string[] } | null
} {
  // Extract short_bio from q32_looking_for (max 140 chars)
  const short_bio = answers.q32_looking_for
    ? String(answers.q32_looking_for).slice(0, 140)
    : null

  // Extract intentions from q9_intentions
  const intentions: string[] = Array.isArray(answers.q9_intentions)
    ? answers.q9_intentions
    : []

  // Extract lifestyle_tags from multiple questions
  const lifestyle_tags: string[] = []

  // q18_substances
  if (Array.isArray(answers.q18_substances)) {
    lifestyle_tags.push(...answers.q18_substances)
  } else if (answers.q18_substances) {
    lifestyle_tags.push(answers.q18_substances)
  }

  // q23_erotic_styles
  if (Array.isArray(answers.q23_erotic_styles)) {
    lifestyle_tags.push(...answers.q23_erotic_styles)
  }

  // q24_experiences
  if (Array.isArray(answers.q24_experiences)) {
    lifestyle_tags.push(...answers.q24_experiences)
  }

  // q33_kinks
  if (Array.isArray(answers.q33_kinks)) {
    lifestyle_tags.push(...answers.q33_kinks)
  } else if (answers.q33_kinks) {
    lifestyle_tags.push(answers.q33_kinks)
  }

  // Extract structure from q4_relationship_status and q6a_connection_type
  let structure: { type: string; open_to?: string[] } | null = null
  if (answers.q4_relationship_status) {
    const status = String(answers.q4_relationship_status)
    const connectionType = answers.q6a_connection_type

    // Determine profile type based on status
    let type = 'solo'
    if (status.toLowerCase().includes('couple') || status.toLowerCase().includes('married')) {
      type = 'couple'
    }

    structure = {
      type,
      open_to: Array.isArray(connectionType) ? connectionType : connectionType ? [connectionType] : []
    }
  }

  // Extract orientation from q3_sexual_orientation
  let orientation: { value: string; seeking?: string[] } | null = null
  if (answers.q3_sexual_orientation) {
    const value = Array.isArray(answers.q3_sexual_orientation)
      ? answers.q3_sexual_orientation.join(', ')
      : answers.q3_sexual_orientation

    orientation = {
      value,
      seeking: answers.q3c_partner_kinsey_preference
        ? (Array.isArray(answers.q3c_partner_kinsey_preference)
            ? answers.q3c_partner_kinsey_preference
            : [answers.q3c_partner_kinsey_preference])
        : []
    }
  }

  return {
    short_bio,
    intentions,
    lifestyle_tags,
    structure,
    orientation
  }
}

async function migrate() {
  console.log('='.repeat(60))
  console.log('Migration: Populate Partnership Fields from Survey Answers')
  console.log('='.repeat(60))
  console.log('')

  // 1a. Find all completed survey responses (partnership-based table)
  console.log('Step 1a: Finding completed survey_responses...')

  const { data: completedSurveys, error: surveyError } = await supabase
    .from('survey_responses')
    .select('partnership_id, answers_json')
    .gte('completion_pct', 100)

  // 1b. Also check user_survey_responses table
  console.log('Step 1b: Finding completed user_survey_responses...')

  const { data: userSurveys, error: userSurveyError } = await supabase
    .from('user_survey_responses')
    .select('user_id, answers_json, completion_pct')
    .gte('completion_pct', 100)

  if (userSurveyError) {
    console.log('Note: user_survey_responses query failed (table may not exist):', userSurveyError.message)
  } else if (userSurveys && userSurveys.length > 0) {
    console.log(`Found ${userSurveys.length} completed user surveys`)

    // For each user survey, find their partnership and add to list
    for (const userSurvey of userSurveys) {
      const { data: membership } = await supabase
        .from('partnership_members')
        .select('partnership_id')
        .eq('user_id', userSurvey.user_id)
        .limit(1)
        .single()

      if (membership && userSurvey.answers_json) {
        // Check if this partnership is already in our list
        const exists = completedSurveys?.some(s => s.partnership_id === membership.partnership_id)
        if (!exists) {
          completedSurveys?.push({
            partnership_id: membership.partnership_id,
            answers_json: userSurvey.answers_json
          })
        }
      }
    }
  }

  if (surveyError) {
    console.error('Error fetching surveys:', surveyError)
    process.exit(1)
  }

  if (!completedSurveys || completedSurveys.length === 0) {
    console.log('No completed surveys found. Nothing to migrate.')
    return
  }

  console.log(`Found ${completedSurveys.length} completed surveys`)
  console.log('')

  // 2. Process each survey and update partnership
  console.log('Step 2: Updating partnership fields...')
  console.log('')

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const survey of completedSurveys) {
    const { partnership_id, answers_json } = survey

    if (!answers_json || typeof answers_json !== 'object') {
      console.log(`  [SKIP] Partnership ${partnership_id}: No valid answers_json`)
      skipCount++
      continue
    }

    // Extract profile fields
    const profileFields = extractProfileFieldsFromSurvey(answers_json as Record<string, any>)

    // Check if partnership already has data
    const { data: existingPartnership } = await supabase
      .from('partnerships')
      .select('id, intentions, lifestyle_tags, short_bio')
      .eq('id', partnership_id)
      .single()

    if (!existingPartnership) {
      console.log(`  [SKIP] Partnership ${partnership_id}: Not found in partnerships table`)
      skipCount++
      continue
    }

    // Check if already populated (non-empty intentions or lifestyle_tags)
    const alreadyPopulated =
      (existingPartnership.intentions && Array.isArray(existingPartnership.intentions) && existingPartnership.intentions.length > 0) ||
      (existingPartnership.lifestyle_tags && Array.isArray(existingPartnership.lifestyle_tags) && existingPartnership.lifestyle_tags.length > 0) ||
      existingPartnership.short_bio

    if (alreadyPopulated) {
      console.log(`  [SKIP] Partnership ${partnership_id}: Already has profile data`)
      skipCount++
      continue
    }

    // Check if partnership has photos to determine profile state
    const { data: photos } = await supabase
      .from('partnership_photos')
      .select('id')
      .eq('partnership_id', partnership_id)
      .eq('photo_type', 'public')
      .limit(1)

    const profileState = photos && photos.length > 0 ? 'live' : 'draft'

    // Update partnership
    const { error: updateError } = await supabase
      .from('partnerships')
      .update({
        short_bio: profileFields.short_bio,
        intentions: profileFields.intentions,
        lifestyle_tags: profileFields.lifestyle_tags,
        structure: profileFields.structure,
        orientation: profileFields.orientation,
        profile_state: profileState
      })
      .eq('id', partnership_id)

    if (updateError) {
      console.log(`  [ERROR] Partnership ${partnership_id}: ${updateError.message}`)
      errorCount++
      continue
    }

    console.log(`  [OK] Partnership ${partnership_id}: Updated with ${profileFields.intentions.length} intentions, ${profileFields.lifestyle_tags.length} tags`)
    successCount++
  }

  // 3. Summary
  console.log('')
  console.log('='.repeat(60))
  console.log('Migration Complete')
  console.log('='.repeat(60))
  console.log(`  Success: ${successCount}`)
  console.log(`  Skipped: ${skipCount}`)
  console.log(`  Errors:  ${errorCount}`)
  console.log(`  Total:   ${completedSurveys.length}`)
}

// Run migration
migrate().catch(console.error)
