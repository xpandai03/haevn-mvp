/**
 * HAEVN Matching Engine - Main Orchestrator
 *
 * This is the primary entry point for calculating compatibility
 * between two partners. It orchestrates:
 *
 * 1. Answer normalization
 * 2. Global constraint checking
 * 3. Category scoring (Intent, Structure, Connection, Chemistry, Lifestyle)
 * 4. Weight renormalization (if Lifestyle excluded)
 * 5. Final score computation
 * 6. Tier assignment
 */

import type {
  RawAnswers,
  NormalizedAnswers,
  CompatibilityResult,
  CompatibilityInput,
  CategoryScore,
  ConstraintResult,
} from './types'

import { normalizeAnswers } from './utils/normalizeAnswers'
import { checkConstraints } from './utils/constraints'
import {
  CATEGORY_WEIGHTS,
  renormalizeWeights,
  getTierFromScore,
  type CategoryName,
} from './utils/weights'

import { scoreIntent } from './categories/intent'
import { scoreStructure } from './categories/structure'
import { scoreConnection } from './categories/connection'
import { scoreChemistry } from './categories/chemistry'
import { scoreLifestyle } from './categories/lifestyle'

/**
 * Calculate full compatibility between two partners.
 *
 * This is the main entry point for the matching engine.
 *
 * @param input - Both partners' answers and metadata
 * @returns Full compatibility result with scores, breakdown, and tier
 */
export function calculateCompatibility(input: CompatibilityInput): CompatibilityResult {
  const { partnerA, partnerB } = input

  // Step 1: Answers are already normalized (passed in as NormalizedAnswers)
  const userAnswers = partnerA.answers
  const matchAnswers = partnerB.answers

  // Step 2: Check global constraints first
  const constraints = checkConstraints(
    userAnswers,
    matchAnswers,
    partnerA.isCouple,
    partnerB.isCouple
  )

  // If constraints fail, return blocked result
  if (!constraints.passed) {
    return createBlockedResult(constraints)
  }

  // Step 3: Score each category
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

  const categories: CategoryScore[] = [
    intentScore,
    structureScore,
    connectionScore,
    chemistryScore,
    lifestyleScore,
  ]

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

  // Step 7: Determine tier
  const tier = getTierFromScore(overallScore)

  return {
    overallScore,
    tier,
    categories,
    constraints,
    lifestyleIncluded: lifestyleScore.included,
    rawWeights,
    normalizedWeights,
  }
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
 * @returns Full compatibility result
 */
export function calculateCompatibilityFromRaw(
  userRaw: RawAnswers,
  matchRaw: RawAnswers,
  userIsCouple: boolean = false,
  matchIsCouple: boolean = false
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
  })
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
function createBlockedResult(constraints: ConstraintResult): CompatibilityResult {
  const emptyCategories: CategoryScore[] = [
    { category: 'intent', score: 0, weight: 30, subScores: [], coverage: 0, included: false },
    { category: 'structure', score: 0, weight: 25, subScores: [], coverage: 0, included: false },
    { category: 'connection', score: 0, weight: 20, subScores: [], coverage: 0, included: false },
    { category: 'chemistry', score: 0, weight: 15, subScores: [], coverage: 0, included: false },
    { category: 'lifestyle', score: 0, weight: 10, subScores: [], coverage: 0, included: false },
  ]

  return {
    overallScore: 0,
    tier: 'Bronze',
    categories: emptyCategories,
    constraints,
    lifestyleIncluded: false,
    rawWeights: { ...CATEGORY_WEIGHTS },
    normalizedWeights: { intent: 0, structure: 0, connection: 0, chemistry: 0, lifestyle: 0 },
  }
}
