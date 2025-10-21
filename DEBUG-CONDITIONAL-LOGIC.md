# 🔍 Debug Guide: Conditional Logic Re-Evaluation

## 🎯 What Was Fixed (Round 2)

After the initial multiselect array fix, there was still an issue with `activeQuestions` not properly triggering re-renders. This has been addressed with:

1. **Memoized `activeQuestions`** - Wrapped in `useMemo` to prevent unnecessary recalculations
2. **Enhanced validation `useEffect`** - Better logging and validation when questions change
3. **Comprehensive logging** - Added console logs to track every step of the process

---

## 🧪 Step-by-Step Testing with Console Logs

### Test Setup

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Open browser to: `http://localhost:3000/onboarding/survey`

3. **Open browser console (F12)** - This is CRITICAL for debugging

---

### Test 1: Forward Flow (Baseline)

**Steps:**
1. Answer Q3 (Sexual Orientation) → Select **"Bisexual"**
2. Watch console for:
   ```
   [Survey] Answer changed: q3_sexual_orientation = ['Bisexual']
   [Survey] Active questions recalculated: 78 questions
   [Survey] Question IDs: ['q1_age', 'q2_gender_identity', ..., 'q3a_fidelity', ...]
   ```
   ✅ **Check:** `q3a_fidelity` should be IN the list

3. Click Continue through to Q4
4. Answer Q4 (Relationship Status) → Select **"Single"**
5. Watch console for:
   ```
   [Survey] Answer changed: q4_relationship_status = Single
   [Survey] Active questions recalculated: 78 questions
   ```

6. Click Continue
7. Watch console for:
   ```
   [Survey] handleNext called
   [Survey] Current index: 4 / 77
   [Survey] Current question: q4_relationship_status
   [Survey] Moving to index: 5 - q3a_fidelity
   ```
   ✅ **Check:** Next question should be `q3a_fidelity`

8. **Expected:** Q3a (fidelity question) appears
9. **Console Check:** `[Survey] Current question validated: q3a_fidelity at index 5`

---

### Test 2: Backward Navigation + Answer Change (The Critical Test)

**Steps:**
1. From Q3a, click **Back** button repeatedly until you reach Q3
2. Watch console for each back navigation:
   ```
   [Survey] handlePrevious called
   [Survey] Current index: 5
   [Survey] Moving to index: 4 - q4_relationship_status
   ```

3. Continue clicking Back until you see:
   ```
   [Survey] Moving to index: 2 - q3_sexual_orientation
   [Survey] Current question validated: q3_sexual_orientation at index 2
   ```

4. Now change Q3 → Select **"Straight/Heterosexual"**
5. **CRITICAL:** Watch console immediately:
   ```
   [Survey] Answer changed: q3_sexual_orientation = ['Straight/Heterosexual']
   [Survey] Active questions recalculated: 77 questions
   [Survey] Question IDs: ['q1_age', 'q2_gender_identity', 'q2a_pronouns', 'q3_sexual_orientation', 'q3b_kinsey_scale', ...]
   ```

6. **✅ PASS:** `q3a_fidelity` should NOT be in the Question IDs list
7. **❌ FAIL:** If `q3a_fidelity` is still in the list, the display logic didn't evaluate correctly

8. Click **Continue**
9. Watch console:
   ```
   [Survey] handleNext called
   [Survey] Current index: 2 / 76
   [Survey] Current question: q3_sexual_orientation
   [Survey] Moving to index: 3 - q3b_kinsey_scale (or whatever the next question is, but NOT q3a_fidelity)
   ```

10. **✅ PASS:** Next question should be Q3b or Q4, SKIPPING Q3a
11. **❌ FAIL:** If next question is q3a_fidelity, the navigation didn't work

---

### Test 3: Multi-Selection Edge Case

**Steps:**
1. Go back to Q3
2. Select **BOTH "Bisexual" AND "Pansexual"** (multiselect)
3. Watch console:
   ```
   [Survey] Answer changed: q3_sexual_orientation = ['Bisexual', 'Pansexual']
   [Survey] Active questions recalculated: 78 questions
   ```

4. **✅ CHECK:** `q3a_fidelity` should be BACK in the Question IDs list

5. Navigate to Q4, select "Single", then Continue
6. **Expected:** Q3a should appear

---

### Test 4: Q4 Dependency Change

**Steps:**
1. Ensure Q3 = "Bisexual" and Q4 = "Single" (so Q3a appears)
2. Navigate forward past Q3a
3. Click Back to Q4
4. Change Q4 → Select **"Married"**
5. Watch console:
   ```
   [Survey] Answer changed: q4_relationship_status = Married
   [Survey] Active questions recalculated: 77 questions
   [Survey] Question IDs: [... NO q3a_fidelity ...]
   ```

6. **✅ CHECK:** `q3a_fidelity` should be REMOVED from the list

7. Click Continue
8. **Expected:** Should skip Q3a and go to next question

---

## 🔍 What to Look For in Console

### Good Signs ✅

```
[Survey] Active questions recalculated: 77 questions
[Survey] Question IDs: ['q1_age', 'q2_gender_identity', ..., 'q4_relationship_status', 'q5_zip_code', ...]
// Notice: q3a_fidelity is NOT in the list when Q3 = Straight
```

```
[Survey] Validating question index: 2 / 77
[Survey] Current question validated: q3_sexual_orientation at index 2
// The validation is running and confirming the current question
```

```
[Survey] handleNext called
[Survey] Moving to index: 3 - q3b_kinsey_scale
// Moving to the correct next question, skipping q3a
```

### Bad Signs ❌

```
[Survey] Active questions recalculated: 78 questions
[Survey] Question IDs: [..., 'q3a_fidelity', ...]
// Q3a is still in the list even though Q3 = Straight (logic didn't evaluate)
```

```
[Survey] Moving to index: 3 - q3a_fidelity
// Moving to Q3a even though it should be hidden
```

```
[Survey] Index out of bounds, adjusting from 5 to 76
// This might indicate the current index is invalid
```

---

## 🐛 Common Issues & Fixes

### Issue 1: "Q3a still appears even after changing Q3 to Straight"

**Check:**
```bash
# Verify the logic evaluator fix was applied
grep -A 10 "Array.isArray(answer)" lib/survey/logic-evaluator.ts
```

**Expected output:** Should show the array handling code

**If missing:** Re-apply the fix from `BUG-FIX-Q3-MULTISELECT.md`

---

### Issue 2: "Console shows q3a_fidelity in active questions when it shouldn't be"

**This means the display logic evaluation is failing.**

**Debug steps:**
1. Check the CSV ID mapping:
   ```bash
   grep -n "csvId.*Q3" lib/survey/questions.ts
   ```
   Expected: Should show `csvId: 'Q3'` for sexual orientation

2. Check the display logic string:
   ```bash
   grep -A 2 "q3a_fidelity" lib/survey/questions.ts
   ```
   Expected: Should show `displayLogic: "Show if Q3 in {...}"`

3. Add debug logging to `buildCsvAnswerMap` in questions.ts:
   ```typescript
   function buildCsvAnswerMap(answers: Record<string, any>): Record<string, any> {
     const csvAnswers: Record<string, any> = {}
     surveySections.forEach(section => {
       section.questions.forEach(question => {
         if (question.csvId && answers[question.id] !== undefined) {
           csvAnswers[question.csvId] = answers[question.id]
           console.log(`[CSV Map] ${question.id} (${question.csvId}) = ${JSON.stringify(answers[question.id])}`)
         }
       })
     })
     return csvAnswers
   }
   ```

---

### Issue 3: "activeQuestions keeps recalculating on every render"

**Check useMemo is working:**

Open console and count how many times you see:
```
[Survey] Active questions recalculated
```

**Expected:** Should only appear when you actually change an answer, not on every render

**If appearing too often:** Check that the `useMemo` dependency is just `[answers]`

---

### Issue 4: "Navigation doesn't update after changing answer"

**This might be a React state issue.**

**Check:**
1. Make sure `setCurrentQuestionIndex` is being called
2. Make sure `useEffect` is running when `activeQuestions` changes
3. Check for infinite loops (too many console logs)

**Add a render counter:**
```typescript
const renderCount = useRef(0)
useEffect(() => {
  renderCount.current++
  console.log('[Survey] Render count:', renderCount.current)
})
```

Expected: Should increment on each state change, but not infinitely

---

## 📊 Expected Console Flow for Full Test

```
// Initial load
[Survey] Active questions recalculated: 77 questions
[Survey] Question IDs: [...]
[Survey] Validating question index: 0 / 76
[Survey] Current question validated: q1_age at index 0

// Answer Q3 with Bisexual
[Survey] Answer changed: q3_sexual_orientation = ['Bisexual']
[Survey] Active questions recalculated: 78 questions
[Survey] Question IDs: [..., 'q3a_fidelity', ...]  // ← Q3a is now in the list

// Navigate forward
[Survey] handleNext called
[Survey] Moving to index: 1 - q2_gender_identity

// ... continue navigating ...

// Change Q3 to Straight
[Survey] Answer changed: q3_sexual_orientation = ['Straight/Heterosexual']
[Survey] Active questions recalculated: 77 questions
[Survey] Question IDs: [... NO q3a_fidelity ...]  // ← Q3a removed!

// Navigate forward
[Survey] handleNext called
[Survey] Moving to index: 3 - q3b_kinsey_scale  // ← Skipped Q3a!
```

---

## ✅ Success Criteria

- [ ] Changing Q3 from Bisexual → Straight removes q3a_fidelity from active questions
- [ ] Changing Q4 from Single → Married removes q3a_fidelity from active questions
- [ ] Selecting multiple orientations (Bisexual + Pansexual) keeps q3a_fidelity active
- [ ] Console shows correct active questions list after each change
- [ ] Navigation skips hidden questions automatically
- [ ] No infinite re-renders (render count stays reasonable)
- [ ] No console errors

---

## 🚀 Next Steps After Verification

Once all tests pass:

1. Remove or reduce console logging (optional - can keep for production debugging)
2. Test other conditional questions (Q6c, Q6d, Q33a)
3. Test on different browsers
4. Test with different user flows (skip questions, come back, etc.)

---

**Last Updated:** 2025-10-18
**Status:** Ready for Testing
**Key Files Modified:** `page.tsx`, `logic-evaluator.ts`, `questions.ts`
