/**
 * Test file for conditional survey logic
 *
 * Run this file to verify all display logic patterns work correctly:
 * npx ts-node lib/survey/test-logic.ts
 */

import { parseDisplayLogic, conditionToString } from './logic-parser'
import { evaluateDisplayLogic, explainEvaluation } from './logic-evaluator'

// Test cases for all 4 patterns from the CSV
const testCases = [
  {
    name: 'Q3a - Compound AND condition',
    logic: "Show if Q3 in {Bisexual,Pansexual,Queer,Fluid,Other} AND Q4 in {Single,Solo Poly,Dating}",
    testData: [
      {
        answers: { Q3: 'Bisexual', Q4: 'Single' },
        expectedResult: true,
        description: 'Both conditions satisfied'
      },
      {
        answers: { Q3: 'Bisexual', Q4: 'Married' },
        expectedResult: false,
        description: 'First condition met, second not met'
      },
      {
        answers: { Q3: 'Straight/Heterosexual', Q4: 'Single' },
        expectedResult: false,
        description: 'Second condition met, first not met'
      },
      {
        answers: { Q3: 'Pansexual', Q4: 'Dating' },
        expectedResult: true,
        description: 'Different values, both conditions satisfied'
      },
      {
        answers: {},
        expectedResult: false,
        description: 'No answers provided'
      }
    ]
  },
  {
    name: 'Q6c - Includes operator',
    logic: "Show if Q6a includes 'couple'",
    testData: [
      {
        answers: { Q6a: ['As an individual', 'As a couple'] },
        expectedResult: true,
        description: 'Array includes "couple"'
      },
      {
        answers: { Q6a: ['As an individual'] },
        expectedResult: false,
        description: 'Array does not include "couple"'
      },
      {
        answers: { Q6a: 'As a couple' },
        expectedResult: true,
        description: 'String value "As a couple"'
      },
      {
        answers: {},
        expectedResult: false,
        description: 'No answer provided'
      }
    ]
  },
  {
    name: 'Q6d - Equals operator',
    logic: "Show if Q6c='Custom / differs by partner'",
    testData: [
      {
        answers: { Q6c: 'Custom / differs by partner' },
        expectedResult: true,
        description: 'Exact match'
      },
      {
        answers: { Q6c: 'Together only' },
        expectedResult: false,
        description: 'Different value'
      },
      {
        answers: { Q6c: 'custom / differs by partner' },
        expectedResult: true,
        description: 'Case-insensitive match'
      },
      {
        answers: {},
        expectedResult: false,
        description: 'No answer provided'
      }
    ]
  },
  {
    name: 'Q33a - Answered operator',
    logic: 'Show if Q33 answered',
    testData: [
      {
        answers: { Q33: ['Bondage', 'Role play'] },
        expectedResult: true,
        description: 'Multi-select array with values'
      },
      {
        answers: { Q33: [] },
        expectedResult: false,
        description: 'Empty array'
      },
      {
        answers: { Q33: 'Bondage' },
        expectedResult: true,
        description: 'String answer'
      },
      {
        answers: { Q33: '' },
        expectedResult: false,
        description: 'Empty string'
      },
      {
        answers: {},
        expectedResult: false,
        description: 'No answer provided'
      }
    ]
  }
]

// Run tests
function runTests() {
  console.log('🧪 Testing HAEVN Survey Display Logic\n')
  console.log('=' .repeat(80))

  let totalTests = 0
  let passedTests = 0
  let failedTests = 0

  testCases.forEach(testCase => {
    console.log(`\n📋 Testing: ${testCase.name}`)
    console.log(`   Logic: ${testCase.logic}`)

    // Parse the logic
    const condition = parseDisplayLogic(testCase.logic)
    console.log(`   Parsed: ${conditionToString(condition)}`)
    console.log('')

    testCase.testData.forEach((test, idx) => {
      totalTests++

      const result = evaluateDisplayLogic(condition, test.answers)
      const passed = result === test.expectedResult

      if (passed) {
        passedTests++
        console.log(`   ✅ Test ${idx + 1}: ${test.description}`)
      } else {
        failedTests++
        console.log(`   ❌ Test ${idx + 1}: ${test.description}`)
        console.log(`      Expected: ${test.expectedResult}, Got: ${result}`)
        console.log(`      Answers: ${JSON.stringify(test.answers)}`)
        console.log(`      Explanation: ${explainEvaluation(condition, test.answers)}`)
      }
    })
  })

  console.log('\n' + '='.repeat(80))
  console.log(`\n📊 Test Results:`)
  console.log(`   Total: ${totalTests}`)
  console.log(`   Passed: ${passedTests} ✅`)
  console.log(`   Failed: ${failedTests} ${failedTests > 0 ? '❌' : ''}`)
  console.log(`   Success Rate: ${Math.round((passedTests / totalTests) * 100)}%`)

  if (failedTests === 0) {
    console.log('\n🎉 All tests passed!')
  } else {
    console.log(`\n⚠️  ${failedTests} test(s) failed. Please review the logic.`)
  }
}

// Run the tests
runTests()
