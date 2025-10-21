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
  conditions: SimpleCondition[]
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

  // Check for compound conditions (AND/OR)
  if (cleaned.includes(' AND ')) {
    return parseCompoundCondition(cleaned, 'AND')
  }

  if (cleaned.includes(' OR ')) {
    return parseCompoundCondition(cleaned, 'OR')
  }

  // Parse as simple condition
  return parseSimpleCondition(cleaned)
}

/**
 * Parse a compound condition (multiple conditions with AND/OR)
 */
function parseCompoundCondition(
  logicString: string,
  combinator: LogicCombinator
): CompoundCondition | null {
  const parts = logicString.split(` ${combinator} `)

  const conditions: SimpleCondition[] = []

  for (const part of parts) {
    const condition = parseSimpleCondition(part.trim())
    if (condition && condition.type === 'simple') {
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
