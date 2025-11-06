/**
 * Logic Evaluator for HAEVN Survey Display Logic
 *
 * Evaluates parsed Display Logic conditions against user answers
 * to determine if a question should be shown.
 */

import {
  DisplayCondition,
  SimpleCondition,
  CompoundCondition
} from './logic-parser'

/**
 * Evaluate a display condition against user answers
 *
 * @param condition - The parsed display condition
 * @param answers - User's survey answers (keyed by question ID)
 * @returns true if condition is satisfied (show question), false otherwise
 */
export function evaluateDisplayLogic(
  condition: DisplayCondition | null,
  answers: Record<string, any>
): boolean {
  // No condition means always show
  if (!condition) {
    return true
  }

  if (condition.type === 'simple') {
    return evaluateSimpleCondition(condition, answers)
  }

  if (condition.type === 'compound') {
    return evaluateCompoundCondition(condition, answers)
  }

  return true
}

/**
 * Evaluate a simple condition
 */
function evaluateSimpleCondition(
  condition: SimpleCondition,
  answers: Record<string, any>
): boolean {
  const { questionId, operator, values } = condition

  // Special case: __FALSE__ means always hidden
  if (questionId === '__FALSE__') {
    return false
  }

  const answer = answers[questionId]

  switch (operator) {
    case 'answered':
      return isAnswered(answer)

    case 'equals':
      return evaluateEquals(answer, values?.[0])

    case 'in':
      return evaluateIn(answer, values || [])

    case 'includes':
      return evaluateIncludes(answer, values?.[0])

    default:
      console.warn(`[logic-evaluator] Unknown operator: ${operator}`)
      return false
  }
}

/**
 * Evaluate a compound condition (AND/OR)
 * Now supports recursive evaluation for nested compound conditions
 */
function evaluateCompoundCondition(
  condition: CompoundCondition,
  answers: Record<string, any>
): boolean {
  const { combinator, conditions } = condition

  if (combinator === 'AND') {
    // All conditions must be true
    return conditions.every(c => {
      if (c.type === 'compound') {
        return evaluateCompoundCondition(c, answers)
      }
      return evaluateSimpleCondition(c, answers)
    })
  }

  if (combinator === 'OR') {
    // At least one condition must be true
    return conditions.some(c => {
      if (c.type === 'compound') {
        return evaluateCompoundCondition(c, answers)
      }
      return evaluateSimpleCondition(c, answers)
    })
  }

  return false
}

/**
 * Check if a question has been answered
 */
function isAnswered(answer: any): boolean {
  if (answer === undefined || answer === null) {
    return false
  }

  if (typeof answer === 'string') {
    return answer.trim() !== ''
  }

  if (Array.isArray(answer)) {
    return answer.length > 0
  }

  if (typeof answer === 'number') {
    return true
  }

  if (typeof answer === 'boolean') {
    return true
  }

  return false
}

/**
 * Evaluate equals operator (exact match)
 */
function evaluateEquals(answer: any, targetValue?: string): boolean {
  if (!targetValue) {
    return false
  }

  if (!isAnswered(answer)) {
    return false
  }

  const normalizedTarget = targetValue.trim().toLowerCase()

  // Handle array answers (from multiselect questions)
  if (Array.isArray(answer)) {
    // For arrays, check if ANY element matches (same behavior as 'includes')
    return answer.some(answerValue => {
      const normalizedAnswer = String(answerValue).trim().toLowerCase()
      return normalizedAnswer === normalizedTarget
    })
  }

  // Handle single-value answers
  const normalizedAnswer = String(answer).trim().toLowerCase()
  return normalizedAnswer === normalizedTarget
}

/**
 * Evaluate 'in' operator (answer matches any value in set)
 */
function evaluateIn(answer: any, targetValues: string[]): boolean {
  if (!isAnswered(answer)) {
    return false
  }

  if (targetValues.length === 0) {
    return false
  }

  // Normalize target values
  const normalizedTargets = targetValues.map(v => v.trim().toLowerCase())

  // Handle array answers (from multiselect questions)
  if (Array.isArray(answer)) {
    // Check if ANY answer value matches ANY target value
    return answer.some(answerValue => {
      const normalizedAnswer = String(answerValue).trim().toLowerCase()
      return normalizedTargets.includes(normalizedAnswer)
    })
  }

  // Handle single-value answers
  const normalizedAnswer = String(answer).trim().toLowerCase()
  return normalizedTargets.includes(normalizedAnswer)
}

/**
 * Evaluate 'includes' operator (for multiselect - check if array includes value)
 */
function evaluateIncludes(answer: any, targetValue?: string): boolean {
  if (!targetValue) {
    return false
  }

  if (!isAnswered(answer)) {
    return false
  }

  // If answer is an array, check if it includes the target
  if (Array.isArray(answer)) {
    const normalizedTarget = targetValue.trim().toLowerCase()
    return answer.some(item =>
      String(item).trim().toLowerCase() === normalizedTarget
    )
  }

  // If answer is a string, check if it matches
  const normalizedAnswer = String(answer).trim().toLowerCase()
  const normalizedTarget = targetValue.trim().toLowerCase()

  return normalizedAnswer === normalizedTarget
}

/**
 * Utility: Explain why a condition evaluated to a specific result (for debugging)
 */
export function explainEvaluation(
  condition: DisplayCondition | null,
  answers: Record<string, any>
): string {
  if (!condition) {
    return 'No condition - always show'
  }

  const result = evaluateDisplayLogic(condition, answers)

  if (condition.type === 'simple') {
    const { questionId, operator, values } = condition
    const answer = answers[questionId]

    return `${questionId} ${operator} ${values?.join(', ')} | answer: ${JSON.stringify(answer)} → ${result}`
  }

  if (condition.type === 'compound') {
    const explanations = condition.conditions.map(c => {
      const simpleResult = evaluateSimpleCondition(c, answers)
      return `${c.questionId} ${c.operator} ${c.values?.join(', ')} → ${simpleResult}`
    })

    return `(${explanations.join(` ${condition.combinator} `)}) → ${result}`
  }

  return 'Unknown condition type'
}
