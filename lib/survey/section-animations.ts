/**
 * Lottie animation CDN URLs for survey sections
 * Using LottieFiles CDN for lightweight, optimized animations
 *
 * Each section has:
 * - intro: Played when section starts (2s)
 * - completion: Played when section finishes (1s)
 */

export interface SectionAnimation {
  intro: string
  completion: string
  description: string
}

export const sectionAnimations: Record<string, SectionAnimation> = {
  // Section 1: Basic Information
  'basic_demographics': {
    intro: 'https://lottie.host/b38a5343-af65-4371-b7bd-9e5c5e3cb407/7lJu9WBrDq.lottie',
    completion: 'https://lottie.host/8fe2242a-4449-452b-95b9-aa6c979fdca4/p3Ht3GBPQq.lottie',
    description: 'Profile icon building → Checkmark celebration'
  },

  // Section 2: Relationship Preferences
  'relationship_preferences': {
    intro: 'https://lottie.host/3d0fd2fd-eb2c-4d20-ad94-2bd794c37323/vL2pIlqXMd.lottie',
    completion: 'https://lottie.host/9137fd10-5f36-4014-967f-94fadecd41a3/mwfiybHSBk.lottie',
    description: 'Hearts connecting → Hearts celebration'
  },

  // Section 3: Communication & Connection
  'communication_attachment': {
    intro: 'https://lottie.host/7b9ecc44-e20f-4c20-8b27-490debb36f31/Ur5H8pt1Jf.lottie',
    completion: 'https://lottie.host/be2ff992-0a5a-4eeb-aa8f-b38c424e8351/AaEby1kS5i.lottie',
    description: 'Speech bubbles → Communication celebration'
  },

  // Section 4: Lifestyle & Values
  'lifestyle_values': {
    intro: 'https://lottie.host/a0f55d6f-80f2-4a7c-8247-4c6872989d0d/9IwsN0JOv7.lottie',
    completion: 'https://lottie.host/86631e77-a6e2-40a0-aac4-0c0c7440670b/fnl2uyaqqi.lottie',
    description: 'Calendar/map → Lifestyle celebration'
  },

  // Section 5: Privacy & Community
  'privacy_community': {
    intro: 'https://lottie.host/3427d2b6-9edb-404d-aba7-7bd60d56a4ad/NYeWQSKZ2e.lottie',
    completion: 'https://lottie.host/c506028e-75b9-43ca-be65-cdb3dc3cb9ad/0JWjH74M3V.lottie',
    description: 'Lock/unlock → Privacy celebration'
  },

  // Section 6: Intimacy & Sexuality (reuses section 2 intro, section 4 completion)
  'intimacy_sexuality': {
    intro: 'https://lottie.host/3d0fd2fd-eb2c-4d20-ad94-2bd794c37323/vL2pIlqXMd.lottie',
    completion: 'https://lottie.host/86631e77-a6e2-40a0-aac4-0c0c7440670b/fnl2uyaqqi.lottie',
    description: 'Hearts (reused) → Lifestyle celebration (reused)'
  },

  // Section 7: Personal Expression (reuses section 3 intro, section 5 completion)
  'personal_expression': {
    intro: 'https://lottie.host/7b9ecc44-e20f-4c20-8b27-490debb36f31/Ur5H8pt1Jf.lottie',
    completion: 'https://lottie.host/c506028e-75b9-43ca-be65-cdb3dc3cb9ad/0JWjH74M3V.lottie',
    description: 'Speech bubbles (reused from communication_attachment) → Privacy celebration (reused)'
  },

  // Section 8: Personality Insights (reuses section 1 intro, section 2 completion)
  'personality_insights': {
    intro: 'https://lottie.host/b38a5343-af65-4371-b7bd-9e5c5e3cb407/7lJu9WBrDq.lottie',
    completion: 'https://lottie.host/9137fd10-5f36-4014-967f-94fadecd41a3/mwfiybHSBk.lottie',
    description: 'Profile (reused) → Hearts celebration (reused)'
  }
}

/**
 * Get animation URLs for a given section ID
 */
export function getSectionAnimations(sectionId: string): SectionAnimation | null {
  return sectionAnimations[sectionId] || null
}

/**
 * Check if a section has animations configured
 */
export function hasSectionAnimations(sectionId: string): boolean {
  return sectionId in sectionAnimations
}
