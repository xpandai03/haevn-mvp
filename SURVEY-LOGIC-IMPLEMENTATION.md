# HAEVN Survey Conditional Logic Implementation

## 📋 Overview

This document describes the implementation of conditional question display logic for the HAEVN onboarding survey, based on the specifications in `SURVEY-SPEC-FINAL.csv`.

## 🎯 What Was Implemented

We created a robust, extensible conditional logic system that dynamically shows/hides survey questions based on user answers. The system supports:

### Operators Supported

1. **`in {...}`** - Check if answer matches any value in a set
   - Example: `Show if Q3 in {Bisexual,Pansexual,Queer,Fluid,Other}`

2. **`includes 'value'`** - Check if multiselect answer includes a specific value
   - Example: `Show if Q6a includes 'couple'`

3. **`= 'value'`** - Exact match comparison
   - Example: `Show if Q6c='custom'`

4. **`answered`** - Check if question has any answer (non-empty)
   - Example: `Show if Q33 answered`

5. **`AND` / `OR`** - Combine multiple conditions
   - Example: `Show if Q3 in {...} AND Q4 in {...}`

---

## 🏗️ Architecture

### Files Created

```
lib/survey/
├── logic-parser.ts          # Parses Display Logic strings into structured conditions
├── logic-evaluator.ts       # Evaluates conditions against user answers
└── questions.ts             # Updated with Display Logic integration
```

### Key Components

#### 1. Logic Parser (`logic-parser.ts`)

**Purpose:** Parse Display Logic strings from CSV into structured TypeScript objects.

**Types:**
```typescript
type LogicOperator = 'in' | 'includes' | 'equals' | 'answered'
type LogicCombinator = 'AND' | 'OR'

interface SimpleCondition {
  type: 'simple'
  questionId: string
  operator: LogicOperator
  values?: string[]
}

interface CompoundCondition {
  type: 'compound'
  combinator: LogicCombinator
  conditions: SimpleCondition[]
}
```

**Main Function:**
```typescript
parseDisplayLogic(logicString: string): DisplayCondition | null
```

#### 2. Logic Evaluator (`logic-evaluator.ts`)

**Purpose:** Evaluate parsed conditions against user answers to determine if a question should be displayed.

**Main Function:**
```typescript
evaluateDisplayLogic(
  condition: DisplayCondition | null,
  answers: Record<string, any>
): boolean
```

**Evaluation Rules:**
- **`answered`**: Returns true if answer exists and is non-empty (handles strings, arrays, numbers, booleans)
- **`equals`**: Case-insensitive string comparison
- **`in`**: Case-insensitive check if answer matches any value in the set
- **`includes`**: For arrays, checks if array includes the value; for strings, checks equality
- **`AND`**: All conditions must be true
- **`OR`**: At least one condition must be true

#### 3. Updated Questions Schema (`questions.ts`)

**New Fields:**
```typescript
interface SurveyQuestion {
  // ... existing fields
  csvId?: string                      // CSV Question ID (Q1, Q2, Q3a, etc.)
  displayLogic?: string               // Raw Display Logic from CSV
  displayCondition?: DisplayCondition // Parsed condition (cached)
}
```

**Integration:**
```typescript
export function getActiveQuestions(answers: Record<string, any>): SurveyQuestion[] {
  // 1. Build CSV-ID-keyed answer map
  const csvAnswers = buildCsvAnswerMap(answers)

  // 2. Filter questions based on display logic
  surveySections.forEach(section => {
    section.questions.forEach(question => {
      // Check displayLogic
      if (question.displayLogic) {
        if (!question.displayCondition) {
          question.displayCondition = parseDisplayLogic(question.displayLogic)
        }
        if (!evaluateDisplayLogic(question.displayCondition, csvAnswers)) {
          return // Skip this question
        }
      }
      activeQuestions.push(question)
    })
  })

  return activeQuestions
}
```

---

## 📊 Conditional Questions Implemented

Based on `SURVEY-SPEC-FINAL.csv`, the following conditional questions are now fully implemented:

| Question ID | Display Logic | Meaning |
|-------------|---------------|---------|
| **Q3a** | `Show if Q3 in {Bisexual,Pansexual,Queer,Fluid,Other} AND Q4 in {Single,Solo Poly,Dating}` | Fidelity question appears only for non-monosexual users in specific relationship statuses |
| **Q6c** | `Show if Q6a includes 'couple'` | Couple connection style appears only if user selected "As a couple" |
| **Q6d** | `Show if Q6c='Custom / differs by partner'` | Couple permissions appear only if user selected custom connection mode |
| **Q33a** | `Show if Q33 answered` | Kink experience level appears only after kinks are selected |

---

## 🧪 Testing

### Manual Testing in UI

To verify the implementation works correctly:

1. **Test Q3a (Fidelity)**
   - Select `Bisexual` for sexual orientation (Q3)
   - Select `Single` for relationship status (Q4)
   - ✅ Q3a should appear
   - Change Q4 to `Married`
   - ✅ Q3a should disappear

2. **Test Q6c (Couple Connection)**
   - Select `As a couple` in Q6a
   - ✅ Q6c should appear
   - Deselect `As a couple`
   - ✅ Q6c should disappear

3. **Test Q6d (Couple Permissions)**
   - Make Q6c appear (select couple in Q6a)
   - Select `Custom / differs by partner` in Q6c
   - ✅ Q6d should appear
   - Change Q6c to `Together only`
   - ✅ Q6d should disappear

4. **Test Q33a (Kink Experience)**
   - Select any kinks in Q33
   - ✅ Q33a should appear
   - Clear all selections in Q33
   - ✅ Q33a should disappear

### Automated Tests

Run the test verification script:
```bash
node lib/survey/test-logic-simple.js
```

For full TypeScript tests:
```bash
npx tsx lib/survey/test-logic.ts
```

---

## 🔧 How to Add New Conditional Questions

To add a new conditional question from the CSV:

### Step 1: Add CSV ID to Referenced Questions
```typescript
{
  id: 'q_some_question',
  csvId: 'Q42',  // Add this
  label: 'Some question',
  // ... rest of config
}
```

### Step 2: Add Display Logic to the Conditional Question
```typescript
{
  id: 'q_conditional_question',
  csvId: 'Q42a',
  label: 'Conditional question',
  displayLogic: 'Show if Q42 answered',  // Add this
  // ... rest of config
}
```

### Step 3: Test
The logic will be automatically parsed and evaluated. No additional code needed!

---

## 🎨 Example: Full Flow

**User Journey:**
1. User answers Q3 (Sexual Orientation) → selects "Bisexual"
2. User answers Q4 (Relationship Status) → selects "Single"
3. System evaluates: `Q3 in {Bisexual,...} AND Q4 in {Single,...}` → **TRUE**
4. ✅ Q3a (Fidelity question) appears
5. User changes Q4 to "Married"
6. System re-evaluates: `Q3 in {Bisexual,...} AND Q4 in {Married}` → **FALSE**
7. ❌ Q3a disappears (and any answer is preserved for if they change back)

**Under the Hood:**
```typescript
// 1. Survey page calls getActiveQuestions(answers)
const activeQuestions = getActiveQuestions({
  q3_sexual_orientation: 'Bisexual',
  q4_relationship_status: 'Single'
})

// 2. System builds CSV answer map
const csvAnswers = {
  Q3: 'Bisexual',
  Q4: 'Single'
}

// 3. For each question, evaluate display logic
const q3a = questions.find(q => q.id === 'q3a_fidelity')
const condition = parseDisplayLogic(q3a.displayLogic)
// → { type: 'compound', combinator: 'AND', conditions: [...] }

const shouldShow = evaluateDisplayLogic(condition, csvAnswers)
// → evaluateSimpleCondition(Q3 in {...}, csvAnswers)
//    AND evaluateSimpleCondition(Q4 in {...}, csvAnswers)
// → true AND true → true

// 4. Q3a is included in activeQuestions
```

---

## 🚀 Future Enhancements

### Phase 2 (Not Yet Implemented)

1. **Tier-Based Question Filtering**
   - Filter questions based on user tier (Plus/Select/Both)
   - Implement from CSV "Filter Availability" and "Tier" columns

2. **Hard Filters**
   - Implement boundary/safer-sex hard filters (Q28, Q29, Q30, Q30a, Q31)
   - Block incompatible matches based on these answers

3. **CSV as Single Source of Truth**
   - Auto-generate questions.ts from CSV
   - Validation script to ensure CSV → TypeScript sync

4. **Option Key Mapping**
   - Map display labels to CSV option keys (e.g., "Bisexual" → "bi")
   - Enable more precise matching logic

5. **Advanced Operators**
   - `not in {...}` - Exclusion logic
   - `>=`, `<=` - Numeric comparisons (for age, sliders)
   - `between` - Range checks

---

## 📖 API Reference

### `parseDisplayLogic(logicString: string): DisplayCondition | null`

Parses a Display Logic string into a structured condition.

**Example:**
```typescript
const condition = parseDisplayLogic("Show if Q3 in {Bisexual,Pansexual}")
// Returns: {
//   type: 'simple',
//   questionId: 'Q3',
//   operator: 'in',
//   values: ['Bisexual', 'Pansexual']
// }
```

### `evaluateDisplayLogic(condition: DisplayCondition | null, answers: Record<string, any>): boolean`

Evaluates a condition against user answers.

**Example:**
```typescript
const shouldShow = evaluateDisplayLogic(condition, { Q3: 'Bisexual' })
// Returns: true
```

### `conditionToString(condition: DisplayCondition | null): string`

Converts a parsed condition back to a human-readable string (for debugging).

**Example:**
```typescript
console.log(conditionToString(condition))
// Prints: "Q3 in {Bisexual, Pansexual}"
```

### `explainEvaluation(condition: DisplayCondition | null, answers: Record<string, any>): string`

Explains why a condition evaluated to true/false (for debugging).

**Example:**
```typescript
console.log(explainEvaluation(condition, { Q3: 'Bisexual' }))
// Prints: "Q3 in Bisexual, Pansexual | answer: "Bisexual" → true"
```

---

## ✅ Implementation Checklist

- [x] Create logic parser for Display Logic strings
- [x] Create logic evaluator to evaluate conditions against answers
- [x] Update question interface to support Display Logic
- [x] Integrate logic evaluator into getActiveQuestions()
- [x] Add Display Logic to Q3a (compound AND condition)
- [x] Add Display Logic to Q6c (includes operator)
- [x] Add Display Logic to Q6d (equals operator)
- [x] Add Display Logic to Q33a (answered operator)
- [x] Add CSV IDs to all referenced questions (Q3, Q4, Q6a, Q6c, Q33)
- [x] Create test verification scripts
- [x] Create implementation documentation

---

## 🐛 Known Issues & Limitations

1. **Case Sensitivity:** All comparisons are case-insensitive, which may cause issues if CSV values have specific casing requirements.

2. **Option Label Mapping:** The system currently compares display labels (e.g., "Bisexual") instead of CSV option keys (e.g., "bi"). For now, this works because question options are defined with display labels.

3. **Backward Compatibility:** The legacy `skipCondition` function is still supported but should be migrated to `displayLogic` for consistency.

4. **Performance:** Display logic is parsed on every render. Consider caching parsed conditions in production.

---

## 📞 Support

For questions or issues with the conditional logic system:

1. Review this documentation
2. Check the test scripts: `lib/survey/test-logic.ts` and `test-logic-simple.js`
3. Review the implementation files: `logic-parser.ts`, `logic-evaluator.ts`, `questions.ts`
4. Test in the UI to verify expected behavior

---

**Last Updated:** 2025-10-18
**Version:** 1.0.0
**Status:** ✅ Production Ready
