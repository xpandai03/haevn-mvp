/**
 * Logic Parser for HAEVN Survey Display Logic
 *
 * Parses Display Logic strings from the CSV into structured conditions.
 *
 * Supported patterns:
 * - "Show if Q3 in {Bisexual,Pansexual,Queer}"
 * - "Show if Q6a includes 'couple'"
 * - "Show if Q6c='custom'"
 * - "Show if Q33 answered"
 * - "Show if Q3 in {...} AND Q4 in {...}"
 */

export type LogicOperator = 'in' | 'includes' | 'equals' | 'answered'
export type LogicCombinator = 'AND' | 'OR'

export interface SimpleCondition {
  type: 'simple'
  questionId: string
  operator: LogicOperator
  values?: string[]
}

export interface CompoundCondition {
  type: 'compound'
  combinator: LogicCombinator
  conditions: DisplayCondition[] // Changed to support nested compound conditions
}

export type DisplayCondition = SimpleCondition | CompoundCondition

/**
 * Parse a Display Logic string into a structured condition
 */
export function parseDisplayLogic(logicString: string): DisplayCondition | null {
  if (!logicString || logicString.trim() === '') {
    return null
  }

  // Remove "Show if " prefix
  let cleaned = logicString.replace(/^Show if\s+/i, '').trim()

  if (!cleaned) {
    return null
  }

  // Special case: "false" means always hidden
  if (cleaned.toLowerCase() === 'false') {
    return {
      type: 'simple',
      questionId: '__FALSE__',
      operator: 'equals',
      values: ['false']
    }
  }

  // Parse OR first (top-level combinator)
  // This allows (A AND B) OR (C AND D) to work correctly
  if (cleaned.includes(' OR ')) {
    return parseOrCondition(cleaned)
  }

  // Check for AND conditions
  if (cleaned.includes(' AND ')) {
    return parseCompoundCondition(cleaned, 'AND')
  }

  // Parse as simple condition
  return parseSimpleCondition(cleaned)
}

/**
 * Parse OR condition with potential nested AND clauses
 * Example: "Q4='Single' AND Q6 in {...} OR Q4 in {...} AND Q6='Polyamorous'"
 */
function parseOrCondition(logicString: string): CompoundCondition | null {
  const orParts = logicString.split(' OR ')
  const conditions: DisplayCondition[] = []

  for (const orPart of orParts) {
    const trimmed = orPart.trim()

    // Check if this OR clause contains AND (nested compound)
    if (trimmed.includes(' AND ')) {
      const andCondition = parseCompoundCondition(trimmed, 'AND')
      if (andCondition) {
        conditions.push(andCondition)
      }
    } else {
      // Simple condition within OR
      const simpleCondition = parseSimpleCondition(trimmed)
      if (simpleCondition) {
        conditions.push(simpleCondition)
      }
    }
  }

  if (conditions.length === 0) {
    return null
  }

  return {
    type: 'compound',
    combinator: 'OR',
    conditions
  }
}

/**
 * Parse a compound condition (multiple conditions with AND/OR)
 */
function parseCompoundCondition(
  logicString: string,
  combinator: LogicCombinator
): CompoundCondition | null {
  const parts = logicString.split(` ${combinator} `)

  const conditions: DisplayCondition[] = []

  for (const part of parts) {
    const condition = parseSimpleCondition(part.trim())
    if (condition) {
      conditions.push(condition)
    }
  }

  if (conditions.length === 0) {
    return null
  }

  return {
    type: 'compound',
    combinator,
    conditions
  }
}

/**
 * Parse a simple condition (single question with operator)
 */
function parseSimpleCondition(logicString: string): SimpleCondition | null {
  // Pattern: "Q3 in {Bisexual,Pansexual,Queer}"
  const inPattern = /^(\w+)\s+in\s+\{([^}]+)\}/i
  const inMatch = logicString.match(inPattern)

  if (inMatch) {
    const questionId = inMatch[1]
    const valuesStr = inMatch[2]
    const values = valuesStr.split(',').map(v => v.trim())

    return {
      type: 'simple',
      questionId,
      operator: 'in',
      values
    }
  }

  // Pattern: "Q6a includes 'couple'"
  const includesPattern = /^(\w+)\s+includes\s+['"]([^'"]+)['"]/i
  const includesMatch = logicString.match(includesPattern)

  if (includesMatch) {
    return {
      type: 'simple',
      questionId: includesMatch[1],
      operator: 'includes',
      values: [includesMatch[2]]
    }
  }

  // Pattern: "Q6c='custom'" or "Q6c = 'custom'"
  const equalsPattern = /^(\w+)\s*=\s*['"]([^'"]+)['"]/i
  const equalsMatch = logicString.match(equalsPattern)

  if (equalsMatch) {
    return {
      type: 'simple',
      questionId: equalsMatch[1],
      operator: 'equals',
      values: [equalsMatch[2]]
    }
  }

  // Pattern: "Q33 answered"
  const answeredPattern = /^(\w+)\s+answered/i
  const answeredMatch = logicString.match(answeredPattern)

  if (answeredMatch) {
    return {
      type: 'simple',
      questionId: answeredMatch[1],
      operator: 'answered'
    }
  }

  console.warn(`[logic-parser] Unable to parse logic: "${logicString}"`)
  return null
}

/**
 * Utility: Convert a condition back to a readable string (for debugging)
 */
export function conditionToString(condition: DisplayCondition | null): string {
  if (!condition) return 'null'

  if (condition.type === 'simple') {
    const { questionId, operator, values } = condition

    switch (operator) {
      case 'in':
        return `${questionId} in {${values?.join(', ')}}`
      case 'includes':
        return `${questionId} includes '${values?.[0]}'`
      case 'equals':
        return `${questionId}='${values?.[0]}'`
      case 'answered':
        return `${questionId} answered`
      default:
        return 'unknown'
    }
  }

  if (condition.type === 'compound') {
    const condStrings = condition.conditions.map(c => conditionToString(c))
    return condStrings.join(` ${condition.combinator} `)
  }

  return 'unknown'
}
