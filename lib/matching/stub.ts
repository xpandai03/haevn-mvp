// Compatibility scoring stub for development
// This is a deterministic stub that will be replaced with ML/proper algorithm

export interface SurveyAnswers {
  identity?: {
    gender?: string
    orientation?: string
    relationship_type?: string[]
  }
  intentions?: {
    looking_for?: string[]
    timeline?: string
  }
  boundaries?: {
    privacy_level?: string
    photo_sharing?: string
  }
  logistics?: {
    location_radius?: string
    availability?: string[]
    lifestyle?: string[]
  }
}

export function computeCompatibilityScore(a: SurveyAnswers, b: SurveyAnswers): number {
  // Updated scoring based on corrected weights
  let score = 0
  let maxScore = 0

  // 1. Boundaries alignment (40 points max) - Most important
  maxScore += 40
  if (a.boundaries?.privacy_level && b.boundaries?.privacy_level) {
    const privacyMap: Record<string, number> = {
      'Very private': 0,
      'Somewhat private': 1,
      'Open': 2,
      'Flexible': 1.5
    }

    const aPrivacy = privacyMap[a.boundaries.privacy_level] ?? 1
    const bPrivacy = privacyMap[b.boundaries.privacy_level] ?? 1
    const privacyDiff = Math.abs(aPrivacy - bPrivacy)

    // Less difference = higher score
    score += Math.max(0, 40 - (privacyDiff * 20))
  }

  // 2. Intentions alignment (30 points max)
  maxScore += 30
  if (a.intentions?.looking_for && b.intentions?.looking_for) {
    const aLooking = new Set(a.intentions.looking_for)
    const bLooking = new Set(b.intentions.looking_for)
    const intersection = [...aLooking].filter(x => bLooking.has(x))
    const union = new Set([...aLooking, ...bLooking])

    if (union.size > 0) {
      score += (intersection.length / union.size) * 30
    }
  }

  // 3. Attractions/Relationship structure (20 points max)
  maxScore += 20
  if (a.identity?.relationship_type && b.identity?.relationship_type) {
    const aTypes = new Set(a.identity.relationship_type)
    const bTypes = new Set(b.identity.relationship_type)

    // Check for compatibility in relationship styles
    const compatible =
      (aTypes.has('Monogamous') && bTypes.has('Monogamous')) ||
      (aTypes.has('Polyamorous') && bTypes.has('Polyamorous')) ||
      (aTypes.has('Open') && (bTypes.has('Open') || bTypes.has('Polyamorous'))) ||
      ((aTypes.has('Casual') || bTypes.has('Casual')) && !aTypes.has('Monogamous') && !bTypes.has('Monogamous'))

    if (compatible) {
      score += 20
    } else if ([...aTypes].some(t => bTypes.has(t))) {
      score += 10 // Partial match
    }
  }

  // 4. Identity alignment (10 points max)
  maxScore += 10
  if (a.identity?.gender && b.identity?.gender) {
    // Basic identity compatibility check
    score += 5 // Base points for having identity data

    // Additional points for orientation compatibility
    if (a.identity.orientation && b.identity.orientation) {
      score += 5
    }
  }

  // Bonus points for lifestyle alignment (up to 10 extra)
  if (a.logistics?.lifestyle && b.logistics?.lifestyle) {
    const aLifestyle = new Set(a.logistics.lifestyle)
    const bLifestyle = new Set(b.logistics.lifestyle)
    const commonLifestyles = [...aLifestyle].filter(x => bLifestyle.has(x))

    if (commonLifestyles.length > 0) {
      score += Math.min(10, commonLifestyles.length * 3)
    }
  }

  // Normalize to 0-100 scale
  const finalScore = Math.round((score / maxScore) * 100)
  return Math.min(100, Math.max(0, finalScore))
}

export function getCompatibilityBucket(score: number): 'High' | 'Medium' | 'Low' {
  if (score >= 75) return 'High'
  if (score >= 45) return 'Medium'
  return 'Low'
}

// Helper to generate some variance for demo purposes
export function addDemoVariance(baseScore: number, seed: string): number {
  // Use seed to create consistent but varied scores
  const hashCode = seed.split('').reduce((acc, char) => {
    return ((acc << 5) - acc) + char.charCodeAt(0)
  }, 0)

  const variance = (hashCode % 21) - 10 // -10 to +10 variance
  return Math.min(100, Math.max(0, baseScore + variance))
}