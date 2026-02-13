/**
 * Match Computation Service
 *
 * Automatically calculates and stores compatibility matches in computed_matches table.
 * Called when a user completes onboarding (survey reaches 100%).
 *
 * Architecture:
 *   - All candidate data fetched in ~6 bulk queries (no N+1)
 *   - Scoring runs in-memory (pure computation)
 *   - Results batch-upserted in a single write
 *   - Tracks run status in match_compute_runs table
 */

'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import {
  calculateCompatibility,
  normalizeAnswers,
  validateNormalizedAnswers,
  resolveToCanonicalKey,
  type RawAnswers,
  type CompatibilityTier,
} from '@/lib/matching'

const ENGINE_VERSION = '5cat-v2'

// =============================================================================
// TYPES
// =============================================================================

export interface ComputeMatchesResult {
  success: boolean
  matchesComputed: number
  candidatesEvaluated: number
  errors: number
  error?: string
}

export interface RecomputeAllResult {
  total: number
  computed: number
  errors: number
  details: Array<{
    partnershipId: string
    success: boolean
    matchesComputed: number
    error?: string
  }>
}

// =============================================================================
// RUN TRACKING HELPERS
// =============================================================================

async function updateRunStatus(
  adminClient: ReturnType<typeof createAdminClient>,
  runId: string | null,
  update: Record<string, any>
) {
  if (!runId) return
  try {
    await adminClient
      .from('match_compute_runs')
      .update(update)
      .eq('id', runId)
  } catch (err) {
    // Don't let run tracking failures break computation
    console.warn('[computeMatches] Failed to update run status:', err)
  }
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Compute matches for a single partnership against all other partnerships.
 *
 * DIAGNOSTIC BUILD: All filters log before skipping. Filters temporarily
 * bypassed to isolate which one eliminates candidates.
 */
export async function computeMatchesForPartnership(
  partnershipId: string,
  runId: string | null = null
): Promise<ComputeMatchesResult> {
  const adminClient = createAdminClient()
  let matchesComputed = 0
  let candidatesEvaluated = 0
  let errors = 0

  // Mark run as running
  await updateRunStatus(adminClient, runId, {
    status: 'running',
    started_at: new Date().toISOString(),
  })

  try {
    console.log(`[computeMatches] ========== START partnership=${partnershipId} engine=${ENGINE_VERSION} ==========`)

    // =========================================================================
    // 1. Fetch current partnership
    // =========================================================================
    const { data: currentPartnership, error: currentError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name')
      .eq('id', partnershipId)
      .single()

    if (currentError || !currentPartnership) {
      const errMsg = `Partnership not found: ${currentError?.message || 'Unknown error'}`
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    console.log(`[computeMatches] Current: ${currentPartnership.display_name} | city=${currentPartnership.city} | msa=${currentPartnership.msa} | type=${currentPartnership.profile_type}`)

    // =========================================================================
    // 2. Fetch current partnership's survey answers
    // =========================================================================
    const { data: currentMembers } = await adminClient
      .from('partnership_members')
      .select('user_id')
      .eq('partnership_id', partnershipId)

    if (!currentMembers || currentMembers.length === 0) {
      const errMsg = 'Partnership has no members'
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    const currentMemberIds = currentMembers.map(m => m.user_id)
    const { data: currentSurveys } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', currentMemberIds)

    console.log(`[computeMatches] Current members: ${currentMemberIds.length}, surveys found: ${currentSurveys?.length ?? 0}`)
    if (currentSurveys) {
      for (const s of currentSurveys) {
        console.log(`[computeMatches]   survey user=${s.user_id} completion=${s.completion_pct}% hasAnswers=${!!s.answers_json} answerKeyCount=${s.answers_json ? Object.keys(s.answers_json as any).length : 0}`)
      }
    }

    const currentCompletedSurvey = currentSurveys?.find(
      s => s.completion_pct >= 100 && s.answers_json
    )

    if (!currentCompletedSurvey?.answers_json) {
      const errMsg = 'Partnership has no completed survey'
      console.warn(`[computeMatches] ${errMsg} for ${partnershipId}`)
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    const currentAnswers = currentCompletedSurvey.answers_json as RawAnswers
    const currentIsCouple = currentPartnership.profile_type === 'couple'

    // =========================================================================
    // KEY MISMATCH DIAGNOSTIC — exact comparison of DB keys vs alias map
    // =========================================================================
    const rawKeys = Object.keys(currentAnswers)

    // 1. Print first 20 raw keys from DB
    console.log(`[KEY-DIAG] ===== RAW DB KEYS (first 20 of ${rawKeys.length}) =====`)
    for (let i = 0; i < Math.min(20, rawKeys.length); i++) {
      const k = rawKeys[i]
      const resolved = resolveToCanonicalKey(k)
      const mapped = resolved !== k
      console.log(`[KEY-DIAG]   [${i}] "${k}" → resolved="${resolved}" mapped=${mapped}`)
    }

    // 2. Print all keys in INTERNAL_TO_CSV alias map
    const ALIAS_MAP_KEYS = [
      'q1_age','q2_gender_identity','q2a_pronouns','q3_sexual_orientation',
      'q3a_fidelity','q3b_kinsey_scale','q3c_partner_kinsey_preference',
      'q4_relationship_status','q6_relationship_styles','q6a_connection_type',
      'q6b_who_to_meet','q6c_couple_connection','q6d_couple_permissions',
      'q7_emotional_exclusivity','q8_sexual_exclusivity','q9_intentions',
      'q9a_sex_or_more','q9b_dating_readiness','q10_attachment_style',
      'q10a_emotional_availability','q11_love_languages','q12_conflict_resolution',
      'q12a_messaging_pace','q13_lifestyle_alignment','q13a_languages',
      'q14a_cultural_alignment','q14b_cultural_identity','q15_time_availability',
      'q16_typical_availability','q16a_first_meet_preference','q18_substances',
      'q19a_max_distance','q19b_distance_priority','q19c_mobility',
      'q20_discretion','q20a_photo_sharing','q20b_how_out','q21_platform_use',
      'q22_spirituality_sexuality','q23_erotic_styles','q24_experiences',
      'q25_chemistry_vs_emotion','q25a_frequency','q26_roles',
      'q27_body_type_self','q27_body_type_preferences','q28_hard_boundaries',
      'q29_maybe_boundaries','q30_safer_sex','q30a_fluid_bonding',
      'q31_health_testing','q32_looking_for','q33_kinks','q33a_experience_level',
      'q34_exploration','q34a_variety','q35_agreements','q35a_structure',
      'q36_social_energy','q36a_outgoing','q37_empathy','q37a_harmony',
      'q38_jealousy','q38a_emotional_reactive',
    ]
    console.log(`[KEY-DIAG] ===== ALIAS MAP has ${ALIAS_MAP_KEYS.length} internal keys =====`)

    // 3. Compare: DB keys NOT in alias map
    const aliasSet = new Set(ALIAS_MAP_KEYS.map(k => k.toLowerCase()))
    // Also add CSV keys (Q1, Q2, etc.) as recognized
    const CSV_KEYS = [
      'Q1','Q2','Q2a','Q3','Q3a','Q3b','Q3c','Q4','Q6','Q6a','Q6b','Q6c','Q6d',
      'Q7','Q8','Q9','Q9a','Q9b','Q10','Q10a','Q11','Q12','Q12a','Q13','Q13a',
      'Q14a','Q14b','Q15','Q16','Q16a','Q18','Q19a','Q19b','Q19c','Q20','Q20a',
      'Q20b','Q21','Q22','Q23','Q24','Q25','Q25a','Q26','Q27','Q27b','Q28','Q29',
      'Q30','Q30a','Q31','Q32','Q33','Q33a','Q34','Q34a','Q35','Q35a','Q36','Q36a',
      'Q37','Q37a','Q38','Q38a',
    ]
    const csvSet = new Set(CSV_KEYS.map(k => k.toLowerCase()))
    const allRecognized = new Set([...aliasSet, ...csvSet])

    const dbKeysNotInMap: string[] = []
    const dbKeysInMap: string[] = []
    for (const k of rawKeys) {
      if (allRecognized.has(k.toLowerCase())) {
        dbKeysInMap.push(k)
      } else {
        dbKeysNotInMap.push(k)
      }
    }

    // 4. Compare: alias map keys NOT in DB
    const rawKeySetLower = new Set(rawKeys.map(k => k.toLowerCase()))
    const aliasKeysNotInDb = ALIAS_MAP_KEYS.filter(k => !rawKeySetLower.has(k.toLowerCase()))

    console.log(`[KEY-DIAG] ===== COMPARISON RESULTS =====`)
    console.log(`[KEY-DIAG] DB keys recognized by alias map: ${dbKeysInMap.length}/${rawKeys.length}`)
    console.log(`[KEY-DIAG] DB keys NOT in alias map (${dbKeysNotInMap.length}): ${dbKeysNotInMap.join(', ') || '(none)'}`)
    console.log(`[KEY-DIAG] Alias map keys NOT in DB (${aliasKeysNotInDb.length}): ${aliasKeysNotInDb.join(', ') || '(none)'}`)

    // 5. Log the raw value types for first 5 keys (to check if answers_json is actually populated)
    console.log(`[KEY-DIAG] ===== SAMPLE VALUES (first 5) =====`)
    for (let i = 0; i < Math.min(5, rawKeys.length); i++) {
      const k = rawKeys[i]
      const v = (currentAnswers as any)[k]
      console.log(`[KEY-DIAG]   "${k}": type=${typeof v} isArray=${Array.isArray(v)} value=${JSON.stringify(v)?.slice(0, 100)}`)
    }

    // 6. Now normalize and check the result
    const normalizedCurrentAnswers = normalizeAnswers(currentAnswers)
    const normalizedKeys = Object.keys(normalizedCurrentAnswers)

    console.log(`[KEY-DIAG] ===== POST-NORMALIZATION =====`)
    console.log(`[KEY-DIAG] Input keys: ${rawKeys.length} → Output keys: ${normalizedKeys.length}`)
    console.log(`[KEY-DIAG] Normalized keys: ${normalizedKeys.join(', ')}`)

    // Check critical scoring keys
    const criticalForScoring = ['Q9','Q6','Q3','Q10','Q10a','Q20','Q23','Q26','Q28','Q30']
    const presentCritical = criticalForScoring.filter(k => (normalizedCurrentAnswers as any)[k] !== undefined)
    const missingCritical = criticalForScoring.filter(k => (normalizedCurrentAnswers as any)[k] === undefined)
    console.log(`[KEY-DIAG] Critical scoring keys present (${presentCritical.length}/${criticalForScoring.length}): ${presentCritical.join(', ')}`)
    console.log(`[KEY-DIAG] Critical scoring keys MISSING (${missingCritical.length}): ${missingCritical.join(', ') || '(none)'}`)

    // Validate normalization
    const currentValidation = validateNormalizedAnswers(normalizedCurrentAnswers, 'CURRENT')
    console.log(`[KEY-DIAG] Validation:`, JSON.stringify(currentValidation))

    // =========================================================================
    // 3. Fetch ALL candidate partnerships (live, with display_name)
    // =========================================================================
    const { data: allPartnerships, error: partnershipsError } = await adminClient
      .from('partnerships')
      .select('id, profile_type, city, msa, display_name')
      .neq('id', partnershipId)
      .eq('profile_state', 'live')
      .not('display_name', 'is', null)

    if (partnershipsError) {
      const errMsg = `Failed to fetch partnerships: ${partnershipsError.message}`
      await updateRunStatus(adminClient, runId, {
        status: 'error',
        finished_at: new Date().toISOString(),
        error_message: errMsg,
      })
      return { success: false, matchesComputed: 0, candidatesEvaluated: 0, errors: 0, error: errMsg }
    }

    if (!allPartnerships || allPartnerships.length === 0) {
      console.log(`[computeMatches] No other live partnerships found`)
      await updateRunStatus(adminClient, runId, {
        status: 'success',
        finished_at: new Date().toISOString(),
        candidates_evaluated: 0,
        matches_written: 0,
      })
      return { success: true, matchesComputed: 0, candidatesEvaluated: 0, errors: 0 }
    }

    const candidateIds = allPartnerships.map(p => p.id)
    console.log(`[computeMatches] Found ${allPartnerships.length} live candidates`)

    // =========================================================================
    // 4. Fetch ALL candidate members in one query
    // =========================================================================
    const { data: allMembers } = await adminClient
      .from('partnership_members')
      .select('partnership_id, user_id')
      .in('partnership_id', candidateIds)

    // Build map: partnership_id → user_id[]
    const membersByPartnership = new Map<string, string[]>()
    const allMemberUserIds: string[] = []
    if (allMembers) {
      for (const m of allMembers) {
        const arr = membersByPartnership.get(m.partnership_id) || []
        arr.push(m.user_id)
        membersByPartnership.set(m.partnership_id, arr)
        allMemberUserIds.push(m.user_id)
      }
    }
    console.log(`[computeMatches] Total candidate members: ${allMemberUserIds.length}`)

    // =========================================================================
    // 5. Fetch ALL candidate surveys in one query
    // =========================================================================
    const { data: allSurveys } = await adminClient
      .from('user_survey_responses')
      .select('user_id, answers_json, completion_pct')
      .in('user_id', allMemberUserIds)

    // Build map: user_id → survey
    const surveyByUser = new Map<string, { answers_json: any; completion_pct: number }>()
    if (allSurveys) {
      for (const s of allSurveys) {
        surveyByUser.set(s.user_id, s)
      }
    }
    console.log(`[computeMatches] Total candidate surveys loaded: ${surveyByUser.size}`)

    // =========================================================================
    // 6. Fetch existing handshakes for exclusion
    // =========================================================================
    const { data: handshakes } = await adminClient
      .from('handshakes')
      .select('a_partnership, b_partnership')
      .or(`a_partnership.eq.${partnershipId},b_partnership.eq.${partnershipId}`)

    const excludedIds = new Set<string>()
    if (handshakes) {
      for (const h of handshakes) {
        if (h.a_partnership !== partnershipId) excludedIds.add(h.a_partnership)
        if (h.b_partnership !== partnershipId) excludedIds.add(h.b_partnership)
      }
    }
    console.log(`[computeMatches] Handshake exclusions: ${excludedIds.size}`)

    // =========================================================================
    // 7. Score each candidate in memory — DIAGNOSTIC BUILD
    //    ALL FILTERS BYPASSED: handshake, constraint, tier threshold
    //    Everything is logged. Matches stored regardless.
    // =========================================================================
    let handshakeSkipped = 0
    let noSurvey = 0
    let constraintsFailed = 0
    let belowBronze = 0
    let wouldHaveStored = 0
    const matchRows: Array<{
      partnership_a: string
      partnership_b: string
      score: number
      tier: CompatibilityTier
      breakdown: any
      computed_at: string
      engine_version: string
    }> = []

    for (const candidate of allPartnerships) {
      candidatesEvaluated++

      // STEP 1: Log every candidate before any filter
      console.log(`[computeMatches] --- CANDIDATE ${candidatesEvaluated}/${allPartnerships.length}: ${candidate.display_name} (${candidate.id}) city=${candidate.city} msa=${candidate.msa} type=${candidate.profile_type}`)

      // STEP 2A: Handshake filter — LOG but DO NOT SKIP
      if (excludedIds.has(candidate.id)) {
        handshakeSkipped++
        console.log(`[computeMatches]   FILTER:HANDSHAKE would skip ${candidate.display_name} — BYPASSED for diagnostic`)
        // continue  ← DISABLED
      }

      // Get candidate's completed survey from in-memory maps
      const memberIds = membersByPartnership.get(candidate.id)
      if (!memberIds || memberIds.length === 0) {
        noSurvey++
        console.log(`[computeMatches]   SKIP: no members found for ${candidate.display_name}`)
        continue
      }

      let completedAnswers: RawAnswers | null = null
      for (const uid of memberIds) {
        const survey = surveyByUser.get(uid)
        if (survey && survey.completion_pct >= 100 && survey.answers_json) {
          completedAnswers = survey.answers_json as RawAnswers
          break
        }
      }

      if (!completedAnswers) {
        noSurvey++
        // Log WHY no survey: what completion_pcts exist?
        const surveyDetails = memberIds.map(uid => {
          const s = surveyByUser.get(uid)
          return s ? `user=${uid} completion=${s.completion_pct}% hasAnswers=${!!s.answers_json}` : `user=${uid} NO_SURVEY_ROW`
        })
        console.log(`[computeMatches]   SKIP: no completed survey for ${candidate.display_name}. Details: ${surveyDetails.join('; ')}`)
        continue
      }

      try {
        const matchIsCouple = candidate.profile_type === 'couple'

        // STEP 1: Log candidate raw keys
        const candidateRawKeys = Object.keys(completedAnswers)
        console.log(`[computeMatches]   Candidate RAW keys (${candidateRawKeys.length}): ${candidateRawKeys.slice(0, 10).join(', ')}...`)

        const normalizedMatchAnswers = normalizeAnswers(completedAnswers)

        // STEP 1: Validate candidate normalization
        const matchValidation = validateNormalizedAnswers(normalizedMatchAnswers, candidate.display_name || candidate.id)
        console.log(`[computeMatches]   Candidate NORMALIZED:`, JSON.stringify(matchValidation))

        // Calculate compatibility using the 5-category engine
        const result = calculateCompatibility({
          partnerA: {
            partnershipId,
            userId: '',
            answers: normalizedCurrentAnswers,
            isCouple: currentIsCouple,
          },
          partnerB: {
            partnershipId: candidate.id,
            userId: '',
            answers: normalizedMatchAnswers,
            isCouple: matchIsCouple,
          },
        })

        // STEP 1: Log FULL scoring result for EVERY candidate
        console.log(`[computeMatches]   SCORE: overall=${result.overallScore} tier=${result.tier} constraints=${JSON.stringify(result.constraints)}`)
        for (const cat of result.categories) {
          const matchedCount = cat.subScores.filter(s => s.matched).length
          console.log(`[computeMatches]     ${cat.category}: score=${cat.score} included=${cat.included} coverage=${cat.coverage.toFixed(2)} matched=${matchedCount}/${cat.subScores.length}`)
          // Log individual sub-scores for first 2 candidates
          if (candidatesEvaluated <= 2) {
            for (const sub of cat.subScores) {
              console.log(`[computeMatches]       ${sub.key}: score=${sub.score} matched=${sub.matched} weight=${sub.weight} reason=${sub.reason || '-'}`)
            }
          }
        }

        // STEP 3: Hard assert — log if scoring produces non-zero
        if (result.overallScore > 0) {
          wouldHaveStored++
          console.log(`[computeMatches]   >>> MATCH WOULD HAVE BEEN STORED: ${candidate.display_name} score=${result.overallScore} tier=${result.tier}`)
        }

        // STEP 2B: Constraint filter — LOG but DO NOT SKIP
        if (!result.constraints.passed) {
          constraintsFailed++
          console.log(`[computeMatches]   FILTER:CONSTRAINT would skip ${candidate.display_name}: ${result.constraints.reason || 'unknown'} — BYPASSED for diagnostic`)
          // continue  ← DISABLED
        }

        // STEP 2C: Tier threshold filter — LOG but DO NOT SKIP
        const tierOrder: CompatibilityTier[] = ['Platinum', 'Gold', 'Silver', 'Bronze']
        const tierIndex = tierOrder.indexOf(result.tier)
        if (tierIndex === -1 || tierIndex > tierOrder.indexOf('Bronze')) {
          belowBronze++
          console.log(`[computeMatches]   FILTER:TIER would skip ${candidate.display_name}: score=${result.overallScore} tier=${result.tier} — BYPASSED for diagnostic`)
          // continue  ← DISABLED
        }

        // STORE REGARDLESS — diagnostic build stores everything with score >= 0
        const now = new Date().toISOString()
        const storeTier = result.overallScore > 0 ? result.tier : 'Bronze'

        matchRows.push({
          partnership_a: partnershipId,
          partnership_b: candidate.id,
          score: result.overallScore,
          tier: storeTier,
          breakdown: result.categories,
          computed_at: now,
          engine_version: ENGINE_VERSION,
        })
        matchRows.push({
          partnership_a: candidate.id,
          partnership_b: partnershipId,
          score: result.overallScore,
          tier: storeTier,
          breakdown: result.categories,
          computed_at: now,
          engine_version: ENGINE_VERSION,
        })

        matchesComputed++
        console.log(`[computeMatches]   STORED: ${candidate.display_name} score=${result.overallScore} tier=${storeTier}`)

      } catch (matchError: any) {
        errors++
        console.error(
          `[computeMatches] Error scoring ${candidate.id}:`,
          matchError?.message || matchError
        )
      }
    }

    // =========================================================================
    // 8. Batch upsert all match rows in one write
    // =========================================================================
    if (matchRows.length > 0) {
      console.log(`[computeMatches] Upserting ${matchRows.length} rows (${matchesComputed} pairs)...`)
      const { error: upsertError } = await adminClient
        .from('computed_matches')
        .upsert(matchRows, { onConflict: 'partnership_a,partnership_b' })

      if (upsertError) {
        console.error(`[computeMatches] Batch upsert FAILED:`, upsertError)
        errors += matchRows.length / 2
        matchesComputed = 0
      } else {
        console.log(`[computeMatches] Upsert SUCCESS: ${matchRows.length} rows written`)
      }
    }

    // STEP 4: Diagnostic summary
    console.log(`[computeMatches] ========== DIAGNOSTIC SUMMARY for ${currentPartnership.display_name} (${partnershipId}) ==========`)
    console.log(`[computeMatches]   Candidates evaluated: ${candidatesEvaluated}`)
    console.log(`[computeMatches]   No survey: ${noSurvey}`)
    console.log(`[computeMatches]   Handshake would-skip: ${handshakeSkipped}`)
    console.log(`[computeMatches]   Constraint would-fail: ${constraintsFailed}`)
    console.log(`[computeMatches]   Below-Bronze would-skip: ${belowBronze}`)
    console.log(`[computeMatches]   Score > 0 (would store): ${wouldHaveStored}`)
    console.log(`[computeMatches]   Actually stored: ${matchesComputed}`)
    console.log(`[computeMatches]   Errors: ${errors}`)
    console.log(`[computeMatches] ==========================================================`)

    // Update run status
    await updateRunStatus(adminClient, runId, {
      status: errors > 0 && matchesComputed === 0 ? 'error' : 'success',
      finished_at: new Date().toISOString(),
      candidates_evaluated: candidatesEvaluated,
      matches_written: matchesComputed,
      error_message: errors > 0 ? `${errors} scoring errors` : null,
    })

    return { success: true, matchesComputed, candidatesEvaluated, errors }
  } catch (error: any) {
    console.error(`[computeMatches] Fatal error for partnership ${partnershipId}:`, error)
    await updateRunStatus(adminClient, runId, {
      status: 'error',
      finished_at: new Date().toISOString(),
      error_message: error.message || 'Unknown fatal error',
    })
    return {
      success: false,
      matchesComputed,
      candidatesEvaluated,
      errors,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Recompute matches for all partnerships.
 *
 * DIAGNOSTIC BUILD: Logs aggregate summary after all partnerships processed.
 */
export async function recomputeAllMatches(): Promise<RecomputeAllResult> {
  const adminClient = createAdminClient()
  const details: RecomputeAllResult['details'] = []

  try {
    // Get all live partnerships with display names
    const { data: allPartnerships, error } = await adminClient
      .from('partnerships')
      .select('id, display_name')
      .eq('profile_state', 'live')
      .not('display_name', 'is', null)

    if (error || !allPartnerships) {
      console.error('[recomputeAllMatches] Failed to fetch partnerships:', error)
      return { total: 0, computed: 0, errors: 0, details: [] }
    }

    console.log(`[recomputeAllMatches] ========== RECOMPUTE ALL: ${allPartnerships.length} live partnerships ==========`)
    for (const p of allPartnerships) {
      console.log(`[recomputeAllMatches]   ${p.display_name} (${p.id})`)
    }

    let totalComputed = 0
    let totalErrors = 0
    let totalEvaluated = 0

    for (const partnership of allPartnerships) {
      console.log(`\n[recomputeAllMatches] >>> Processing: ${partnership.display_name} (${partnership.id})`)
      const result = await computeMatchesForPartnership(partnership.id)
      totalComputed += result.matchesComputed
      totalErrors += result.errors
      totalEvaluated += result.candidatesEvaluated

      details.push({
        partnershipId: partnership.id,
        success: result.success,
        matchesComputed: result.matchesComputed,
        error: result.error,
      })
    }

    // STEP 4: Aggregate diagnostic summary
    console.log(`\n[recomputeAllMatches] ========== AGGREGATE SUMMARY ==========`)
    console.log(`[recomputeAllMatches]   Total live partnerships: ${allPartnerships.length}`)
    console.log(`[recomputeAllMatches]   Total candidates evaluated: ${totalEvaluated}`)
    console.log(`[recomputeAllMatches]   Total matches stored: ${totalComputed}`)
    console.log(`[recomputeAllMatches]   Total errors: ${totalErrors}`)
    console.log(`[recomputeAllMatches]   Per-partnership breakdown:`)
    for (const d of details) {
      console.log(`[recomputeAllMatches]     ${d.partnershipId}: ${d.matchesComputed} matches, success=${d.success}${d.error ? ` error=${d.error}` : ''}`)
    }
    console.log(`[recomputeAllMatches] ====================================`)

    return { total: allPartnerships.length, computed: totalComputed, errors: totalErrors, details }
  } catch (error: any) {
    console.error('[recomputeAllMatches] Fatal error:', error)
    return { total: 0, computed: 0, errors: 0, details: [] }
  }
}
