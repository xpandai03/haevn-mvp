# ⚡ Quick Test Guide: Conditional Logic Fix

## 🚀 2-Minute Verification

### Step 1: Start & Open Console
```bash
npm run dev
```
- Go to: `http://localhost:3000/onboarding/survey`
- **Open browser console: F12** (or Right-click → Inspect → Console)

---

### Step 2: The Critical Test

| Step | Action | What to Check in Console |
|------|--------|--------------------------|
| 1 | Q3 → Select **"Bisexual"** | `[Survey] Active questions recalculated: 78 questions`<br>`Question IDs: [..., 'q3a_fidelity', ...]` |
| 2 | Q4 → Select **"Single"** | `[Survey] Active questions recalculated` |
| 3 | Click Continue to Q3a | `[Survey] Moving to index: X - q3a_fidelity` |
| 4 | Click Back to Q3 | `[Survey] handlePrevious called` |
| 5 | Change Q3 → **"Straight/Heterosexual"** | `[Survey] Active questions recalculated: 77 questions`<br>`Question IDs: [... NO q3a_fidelity ...]` ✅ |
| 6 | Click Continue | `[Survey] Moving to index: X - q3b_kinsey_scale` (NOT q3a) ✅ |

---

## ✅ Pass Criteria

**You'll know it's working if:**

1. **Console shows:** `[Survey] Active questions recalculated` when you change answers
2. **Console shows:** Question IDs list WITHOUT `q3a_fidelity` when Q3 = Straight
3. **Navigation:** Skips Q3a and goes to next question

---

## ❌ Fail Criteria

**It's still broken if:**

1. Console shows `q3a_fidelity` in Question IDs when Q3 = Straight
2. Clicking Continue after changing Q3 goes to Q3a
3. No console logs appear (means fix wasn't applied)

---

## 🔍 Console Log Cheat Sheet

### ✅ Good (Working)
```
[Survey] Answer changed: q3_sexual_orientation = ['Straight/Heterosexual']
[Survey] Active questions recalculated: 77 questions
[Survey] Question IDs: ['q1_age', 'q2_gender_identity', ..., 'q4_relationship_status', ...]
                                                              ^ NO q3a_fidelity!
```

### ❌ Bad (Broken)
```
[Survey] Active questions recalculated: 78 questions
[Survey] Question IDs: [..., 'q3a_fidelity', ...]
                              ^ Still there! Bug not fixed.
```

---

## 🐛 If It Doesn't Work

1. **Hard refresh:** Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
2. **Restart server:** Stop (Ctrl+C) and `npm run dev`
3. **Check files:**
   ```bash
   grep -n "useMemo" app/onboarding/survey/page.tsx
   ```
   Should show: `const activeQuestions = useMemo(`

4. **See full guide:** `DEBUG-CONDITIONAL-LOGIC.md`

---

## 📊 Other Questions to Test

| Question | Condition | How to Test |
|----------|-----------|-------------|
| **Q6c** | Show if Q6a includes 'couple' | Select "As a couple" in Q6a → Q6c appears<br>Deselect → Q6c disappears |
| **Q6d** | Show if Q6c = 'Custom' | Select "Custom / differs by partner" in Q6c → Q6d appears |
| **Q33a** | Show if Q33 answered | Select any kinks in Q33 → Q33a appears<br>Clear all → Q33a disappears |

---

## ⏱️ Total Test Time: ~2 minutes

1. Open console (10 sec)
2. Answer Q3 + Q4 (30 sec)
3. Navigate to Q3a (20 sec)
4. Go back, change Q3 (20 sec)
5. Check console logs (20 sec)
6. Click Continue and verify skip (20 sec)

**Done!** ✅

---

**Last Updated:** 2025-10-18
**Status:** Ready for Testing
**Expected Result:** Q3a disappears from active questions when Q3 changes to Straight
