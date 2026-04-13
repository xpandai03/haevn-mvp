// REVISION: Matching Model Update per Rik spec 04-10-2026
/**
 * HAEVN Matching Engine - Main Orchestrator
 *
 * This is the primary entry point for calculating compatibility
 * between two partners. It orchestrates:
 *
 * 1. Answer normalization
 * 2. Global constraint checking (8 hard gates — age_range and distance demoted)
 * 3. Category scoring (Intent, Structure, Connection, Chemistry, Lifestyle)
 *    with classification multipliers (major=1.0, moderate=0.6, light=0.2)
 * 4. Cross-section duplicate concept suppression (0.33× for non-primary)
 * 5. Weight renormalization (if Lifestyle excluded)
 * 6. Final score computation
 * 7. Tier assignment
 */

import type {
  RawAnswers,
  NormalizedAnswers,
  CompatibilityResult,
  CompatibilityInput,
  CategoryScore,
  ConstraintResult,
  DebugOutput,
  DebugRowScore,
} from './types'

import { normalizeAnswers } from './utils/normalizeAnswers'
import { checkConstraints } from './utils/constraints'
import {
  CATEGORY_WEIGHTS,
  renormalizeWeights,
  getTierFromScore,
  type CategoryName,
} from './utils/weights'
import { applyConceptSuppression, weightedAverage as utilWeightedAverage } from './utils/scoring'
import { getRowMetadata } from './constants/classificationMap'
import { CLASSIFICATION_MULTIPLIERS } from './types'

import { scoreIntent } from './categories/intent'
import { scoreStructure } from './categories/structure'
import { scoreConnection } from './categories/connection'
import { scoreChemistry } from './categories/chemistry'
import { scoreLifestyle } from './categories/lifestyle'

/**
 * Options for calculateCompatibility.
 */
export interface CompatibilityOptions {
  debug?: boolean
}

/**
 * Calculate full compatibility between two partners.
 *
 * This is the main entry point for the matching engine.
 *
 * @param input - Both partners' answers and metadata
 * @param options - Optional settings (e.g., debug=true for full breakdown)
 * @returns Full compatibility result with scores, breakdown, and tier
 */
export function calculateCompatibility(
  input: CompatibilityInput,
  options: CompatibilityOptions = {}
): CompatibilityResult {
  const { partnerA, partnerB } = input
  const { debug = false } = options

  const userAnswers = partnerA.answers
  const matchAnswers = partnerB.answers

  const userKeyCount = Object.keys(userAnswers).length
  const matchKeyCount = Object.keys(matchAnswers).length
  if (userKeyCount === 0 || matchKeyCount === 0) {
    console.error(`[calculateCompatibility] EMPTY ANSWERS DETECTED`, {
      partnerA_id: partnerA.partnershipId,
      partnerA_keys: userKeyCount,
      partnerB_id: partnerB.partnershipId,
      partnerB_keys: matchKeyCount,
    })
  }

  // Step 1: Check global constraints (8 hard gates — age_range and distance demoted)
  const constraints = checkConstraints(
    userAnswers,
    matchAnswers,
    partnerA.isCouple,
    partnerB.isCouple
  )

  if (!constraints.passed) {
    return createBlockedResult(constraints, debug)
  }

  // Step 2: Score each category (classification multipliers applied inside each scorer)
  const intentScore = scoreIntent(userAnswers, matchAnswers)
  const structureScore = scoreStructure(
    userAnswers,
    matchAnswers,
    partnerA.isCouple,
    partnerB.isCouple
  )
  const connectionScore = scoreConnection(userAnswers, matchAnswers)
  const chemistryScore = scoreChemistry(userAnswers, matchAnswers)
  const lifestyleScore = scoreLifestyle(userAnswers, matchAnswers)

  let categories: CategoryScore[] = [
    intentScore,
    structureScore,
    connectionScore,
    chemistryScore,
    lifestyleScore,
  ]

  // Step 3: Apply cross-section duplicate concept suppression
  const suppressedData = applyConceptSuppression(
    categories.map(c => ({ category: c.category, subScores: c.subScores }))
  )
  categories = categories.map((cat, i) => {
    const suppressed = suppressedData[i]
    const newScore = utilWeightedAverage(suppressed.subScores)
    return { ...cat, subScores: suppressed.subScores, score: newScore }
  })

  // Step 4: Determine which categories to include
  const excludedCategories: CategoryName[] = []
  if (!lifestyleScore.included) {
    excludedCategories.push('lifestyle')
  }

  // Step 5: Renormalize weights if needed
  const rawWeights = { ...CATEGORY_WEIGHTS }
  const normalizedWeights = renormalizeWeights(excludedCategories)

  // Step 6: Compute final score
  const overallScore = computeFinalScore(categories, normalizedWeights)

  if (overallScore === 0 && userKeyCount > 0 && matchKeyCount > 0) {
    const matchedSubScoreCounts = categories.map(c => ({
      cat: c.category,
      score: c.score,
      included: c.included,
      matchedSubs: c.subScores.filter(s => s.matched).length,
      totalSubs: c.subScores.length,
    }))
    console.warn(`[calculateCompatibility] SCORE=0 with data present`, {
      partnerA_id: partnerA.partnershipId,
      partnerA_keys: userKeyCount,
      partnerB_id: partnerB.partnershipId,
      partnerB_keys: matchKeyCount,
      categories: matchedSubScoreCounts,
    })
  }

  // Step 7: Determine tier
  const tier = getTierFromScore(overallScore)

  const result: CompatibilityResult = {
    overallScore,
    tier,
    categories,
    constraints,
    lifestyleIncluded: lifestyleScore.included,
    rawWeights,
    normalizedWeights,
  }

  // Step 8: Build debug output if requested
  if (debug) {
    result.debug = buildDebugOutput(categories, constraints, normalizedWeights, overallScore, tier)
  }

  return result
}

/**
 * Calculate compatibility from raw survey answers.
 *
 * Convenience function that handles normalization.
 *
 * @param userRaw - Raw answers from User's survey
 * @param matchRaw - Raw answers from Match's survey
 * @param userIsCouple - Whether User is a couple
 * @param matchIsCouple - Whether Match is a couple
 * @param options - Optional settings (e.g., debug=true for full breakdown)
 * @returns Full compatibility result
 */
export function calculateCompatibilityFromRaw(
  userRaw: RawAnswers,
  matchRaw: RawAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false,
  options: CompatibilityOptions = {}
): CompatibilityResult {
  const userAnswers = normalizeAnswers(userRaw)
  const matchAnswers = normalizeAnswers(matchRaw)

  return calculateCompatibility({
    partnerA: {
      partnershipId: '',
      userId: '',
      answers: userAnswers,
      isCouple: userIsCouple,
    },
    partnerB: {
      partnershipId: '',
      userId: '',
      answers: matchAnswers,
      isCouple: matchIsCouple,
    },
  }, options)
}

/**
 * Compute the final weighted score from category scores.
 */
function computeFinalScore(
  categories: CategoryScore[],
  weights: Record<CategoryName, number>
): number {
  let totalWeight = 0
  let weightedSum = 0

  for (const category of categories) {
    if (!category.included) continue

    const weight = weights[category.category]
    weightedSum += category.score * weight
    totalWeight += weight
  }

  if (totalWeight === 0) return 0

  // Weights are already normalized to 100, so divide by 100
  return Math.round(weightedSum / 100)
}

/**
 * Create a result for a blocked match (failed constraints).
 */
function createBlockedResult(constraints: ConstraintResult, debug: boolean = false): CompatibilityResult {
  const emptyCategories: CategoryScore[] = [
    { category: 'intent', score: 0, weight: CATEGORY_WEIGHTS.intent, subScores: [], coverage: 0, included: false },
    { category: 'structure', score: 0, weight: CATEGORY_WEIGHTS.structure, subScores: [], coverage: 0, included: false },
    { category: 'connection', score: 0, weight: CATEGORY_WEIGHTS.connection, subScores: [], coverage: 0, included: false },
    { category: 'chemistry', score: 0, weight: CATEGORY_WEIGHTS.chemistry, subScores: [], coverage: 0, included: false },
    { category: 'lifestyle', score: 0, weight: CATEGORY_WEIGHTS.lifestyle, subScores: [], coverage: 0, included: false },
  ]

  const result: CompatibilityResult = {
    overallScore: 0,
    tier: 'Bronze',
    categories: emptyCategories,
    constraints,
    lifestyleIncluded: false,
    rawWeights: { ...CATEGORY_WEIGHTS },
    normalizedWeights: { intent: 0, structure: 0, connection: 0, chemistry: 0, lifestyle: 0 },
  }

  if (debug) {
    result.debug = {
      hardGateResults: [{ gate: constraints.blockedBy ?? 'unknown', passed: false, reason: constraints.reason }],
      rowScores: [],
      sectionScores: [],
      totalScore: 0,
      tier: 'Bronze',
    }
  }

  return result
}

/**
 * Build the debug output with full row-by-row breakdown.
 */
function buildDebugOutput(
  categories: CategoryScore[],
  constraints: ConstraintResult,
  weights: Record<CategoryName, number>,
  totalScore: number,
  tier: string
): DebugOutput {
  const rowScores: DebugRowScore[] = []

  for (const cat of categories) {
    if (!cat.included) continue

    const catWeight = weights[cat.category] / 100

    for (const sub of cat.subScores) {
      const meta = getRowMetadata(cat.category, sub.key)
      const classification = meta?.classification ?? 'moderate'
      const multiplier = classification === 'hard_gate' ? 0 : CLASSIFICATION_MULTIPLIERS[classification] ?? 1
      const isSuppressed = sub.effectiveWeight !== undefined && sub.effectiveWeight < sub.weight * 0.5

      rowScores.push({
        key: sub.key,
        section: cat.category,
        classification: classification as any,
        rawScore: sub.score,
        baseWeight: sub.weight,
        classificationMultiplier: multiplier,
        conceptSuppressed: isSuppressed,
        effectiveWeight: sub.effectiveWeight ?? sub.weight,
        sectionContribution: sub.matched ? (sub.score * sub.weight / 100) * catWeight : 0,
      })
    }
  }

  const sectionScores = categories
    .filter(c => c.included)
    .map(c => ({
      section: c.category,
      score: c.score,
      weight: weights[c.category],
    }))

  return {
    hardGateResults: [{ gate: 'all', passed: constraints.passed, reason: constraints.reason }],
    rowScores,
    sectionScores,
    totalScore,
    tier,
  }
}
