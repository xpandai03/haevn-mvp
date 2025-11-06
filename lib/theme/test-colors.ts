/**
 * Test file for HAEVN color system
 * Run: npx tsx lib/theme/test-colors.ts
 */

import {
  SECTION_COLORS,
  SECTION_ORDER,
  getSectionColor,
  getSectionPrimaryColor,
  getSectionGlow,
  interpolateColors,
  lightenColor,
  getContrastTextColor,
  getSectionIndex
} from './colors'

console.log('🎨 HAEVN Survey Color System Test\n')
console.log('=' .repeat(80))

// Test 1: Verify all 8 sections have colors
console.log('\n📋 Test 1: All Sections Have Color Definitions')
console.log('-'.repeat(80))

SECTION_ORDER.forEach((sectionId, index) => {
  const colors = getSectionColor(sectionId)
  console.log(`${index + 1}. ${sectionId}`)
  console.log(`   Primary: ${colors.primary}`)
  console.log(`   Glow: ${colors.glow.substring(0, 50)}${colors.glow.length > 50 ? '...' : ''}`)
  console.log(`   Hover: ${colors.hover}`)
  console.log(`   ${colors.description}`)
  console.log('')
})

// Test 2: Utility functions
console.log('\n🔧 Test 2: Color Utility Functions')
console.log('-'.repeat(80))

const goldColor = '#E29E0C'
const tealColor = '#008080'

console.log(`Interpolate Gold → Teal (0%): ${interpolateColors(goldColor, tealColor, 0)}`)
console.log(`Interpolate Gold → Teal (25%): ${interpolateColors(goldColor, tealColor, 0.25)}`)
console.log(`Interpolate Gold → Teal (50%): ${interpolateColors(goldColor, tealColor, 0.5)}`)
console.log(`Interpolate Gold → Teal (75%): ${interpolateColors(goldColor, tealColor, 0.75)}`)
console.log(`Interpolate Gold → Teal (100%): ${interpolateColors(goldColor, tealColor, 1)}`)

console.log(`\nLighten Gold by 10%: ${lightenColor(goldColor, 10)}`)
console.log(`Lighten Gold by 25%: ${lightenColor(goldColor, 25)}`)

console.log(`\nContrast text for Gold (#E29E0C): ${getContrastTextColor(goldColor)}`)
console.log(`Contrast text for Teal (#008080): ${getContrastTextColor(tealColor)}`)
console.log(`Contrast text for Navy (#1E24AA): ${getContrastTextColor('#1E24AA')}`)
console.log(`Contrast text for Light Gray (#EBE6E3): ${getContrastTextColor('#EBE6E3')}`)

// Test 3: Section index mapping
console.log('\n🔢 Test 3: Section Index Mapping')
console.log('-'.repeat(80))

SECTION_ORDER.forEach(sectionId => {
  const index = getSectionIndex(sectionId)
  console.log(`${sectionId} → Index ${index}`)
})

// Test 4: Accessor functions
console.log('\n✅ Test 4: Accessor Functions')
console.log('-'.repeat(80))

const testSection = 'communication_attachment'
console.log(`Section: ${testSection}`)
console.log(`Primary Color: ${getSectionPrimaryColor(testSection)}`)
console.log(`Glow: ${getSectionGlow(testSection)}`)

// Test 5: Validate all colors are valid hex
console.log('\n🔍 Test 5: Validate Color Formats')
console.log('-'.repeat(80))

let allValid = true
SECTION_ORDER.forEach(sectionId => {
  const colors = getSectionColor(sectionId)

  // Check primary (can be gradient or hex)
  const isPrimaryValid = colors.primary.includes('gradient') || /^#[0-9A-F]{6}$/i.test(colors.primary)

  // Check hover (can be gradient or hex)
  const isHoverValid = colors.hover.includes('gradient') || /^#[0-9A-F]{6}$/i.test(colors.hover)

  if (!isPrimaryValid || !isHoverValid) {
    console.log(`❌ ${sectionId}: Invalid color format`)
    allValid = false
  } else {
    console.log(`✅ ${sectionId}: Valid`)
  }
})

console.log('\n' + '='.repeat(80))
if (allValid) {
  console.log('✅ ALL TESTS PASSED - Color system ready!')
} else {
  console.log('❌ SOME TESTS FAILED - Review color definitions')
}
console.log('')
