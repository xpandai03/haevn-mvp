# ⚡ Quick Test: User Data Leakage Fix

## 🎯 5-Minute Critical Test

This tests the most important security fix: preventing survey data from leaking between users.

---

## Test Setup

1. **Open two browser windows side-by-side**
2. **Open terminal to watch logs:**
   ```bash
   npm run dev
   ```
3. **Keep browser console open (F12)** in both windows

---

## The Critical Test

### Part 1: Create Data with User A

| Step | Action | Expected Terminal Output |
|------|--------|--------------------------|
| 1 | Window 1: Sign in as `tester32@test.com` | `[Auth] State change: SIGNED_IN` |
| 2 | Go to `/onboarding/survey` | `[getUserSurveyData] Loading survey for user: <user_a_id>` |
| 3 | Answer 5-10 questions | `[saveUserSurveyData] User authenticated: <user_a_id>`<br>`[saveUserSurveyData] Merged answers count: 7` |
| 4 | Note the user ID from logs | Write down: `user_a_id = _______` |

### Part 2: Switch to User B (The Critical Moment)

| Step | Action | Expected Terminal Output | Expected Browser |
|------|--------|-------------------------|------------------|
| 5 | Window 1: Click Sign Out | `[Auth] Signing out user: <user_a_id>`<br>`[Auth] Clearing client-side state...` | Redirected to home |
| 6 | Window 2: Sign up as `tester100@test.com` | `[Auth] State change: SIGNED_IN, userId: <user_b_id>` | - |
| 7 | Window 2: Go to `/onboarding/survey` | `[Survey] User changed to: <user_b_id>`<br>`[getUserSurveyData] Loading survey for user: <user_b_id>`<br>`[getUserSurveyData] No existing data found` ← **CRITICAL!** | - |
| 8 | **CRITICAL CHECK:** Survey should be EMPTY | - | ✅ Q1, no pre-filled answers |
| 9 | Note the user ID from logs | Write down: `user_b_id = _______` |
| 10 | **Verify:** `user_a_id ≠ user_b_id` | - | ✅ Different IDs |

---

## ✅ Pass Criteria

**The fix is working if:**

1. ✅ Terminal shows: `[getUserSurveyData] No existing data found` for User B
2. ✅ Terminal shows different user IDs for User A and User B
3. ✅ User B's survey starts at Q1 with NO answers
4. ✅ Terminal does NOT show: `[getUserSurveyData] Found existing data for user:` for new user

---

## ❌ Fail Criteria

**The bug is NOT fixed if:**

1. ❌ Terminal shows: `[getUserSurveyData] Found existing data for user: <user_b_id>` (new user)
2. ❌ Terminal shows: `[saveUserSurveyData] Merged answers count: 7` on first load of User B
3. ❌ User B sees pre-filled answers from User A
4. ❌ Survey starts at Q5+ instead of Q1 for new user

---

## 🔍 Expected Console Output

### ✅ Good (Fix Working)

```
Window 1 (User A signs out):
[Auth] 🚪 Signing out user: a1b2c3d4-...
[Auth] User email: tester32@test.com
[Auth] Clearing localStorage items...
[Auth] localStorage cleared
[Auth] Calling Supabase signOut...
[Auth] ✅ Supabase signOut successful
[Auth] Forcing React state clear...
[Auth] ✅ Sign out complete
[Auth] ===== AUTH STATE CHANGE =====
[Auth] Event: SIGNED_OUT
[Auth] Previous user: a1b2c3d4-...

Window 2 (User B signs up):
[Signup Page] ===== STARTING SIGNUP =====
[Signup Page] Email: tester100@test.com
[Signup Page] Calling signUp...
[Auth] 🆕 Starting signup for: tester100@test.com
[Auth] ✅ Signup successful!
[Auth] New user ID: e5f6g7h8-...  ← DIFFERENT from User A!
[Signup Page] ✅ SignUp successful!
[Signup Page] New user ID: e5f6g7h8-...
[Signup Page] Calling signIn for auto-login...
[Auth] 🔐 Starting sign in for: tester100@test.com
[Auth] ✅ Sign in successful!
[Auth] User ID: e5f6g7h8-...
[Auth] ===== AUTH STATE CHANGE =====
[Auth] Event: SIGNED_IN
[Auth] Session: { userId: 'e5f6g7h8-...', email: 'tester100@test.com' }
[Survey] ===== USER CHANGE DETECTION =====
[Survey] Current user: e5f6g7h8-...
[Survey] ✅ User detected: e5f6g7h8-...
[getUserSurveyData] Loading survey for user: e5f6g7h8-...
[getUserSurveyData] Querying user_survey_responses for user_id: e5f6g7h8-...
[getUserSurveyData] No existing data found - creating empty survey
```

### ❌ Bad (Bug Still Exists)

**If you see the SAME user ID for different emails:**
```
Window 2 (User B signs up with tester100@test.com):
[Signup Page] ===== STARTING SIGNUP =====
[Signup Page] Email: tester100@test.com  ← Different email!
[Auth] 🆕 Starting signup for: tester100@test.com
[Auth] Current user before signup: a1b2c3d4-...  ← Old user ID still here!
[Auth] New user ID: a1b2c3d4-...  ← WRONG! Same ID as User A!
[Survey] User changed to: a1b2c3d4-...  ← Same ID!
[getUserSurveyData] Loading survey for user: a1b2c3d4-...
[getUserSurveyData] Found existing data for user: a1b2c3d4-...  ← WRONG!
[getUserSurveyData] Answers count: 7  ← Data from User A!
```

**If signOut doesn't clear localStorage:**
```
Window 1 (User A signs out):
[Auth] 🚪 Signing out user: a1b2c3d4-...
[Auth] ❌ Supabase signOut error: {...}  ← Error during signOut!
[Auth] Forcing local state clear despite error...  ← Fallback cleanup
```

---

## 🚨 What to Do If Test Fails

### If User B sees User A's data:

1. **Check the user IDs in terminal** - Are they the same? (should be different)
2. **Hard refresh browser** - Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
3. **Clear browser data:**
   - Open DevTools (F12)
   - Application tab → Storage → Clear site data
   - Refresh
4. **Check Supabase database:**
   ```sql
   SELECT user_id, completion_pct, created_at
   FROM user_survey_responses
   ORDER BY created_at DESC
   LIMIT 10;
   ```
   Should show separate rows for each user

---

## 📊 Database Verification (Optional)

After the test, verify the database has correct data:

```sql
-- Check User A's data exists
SELECT user_id, completion_pct
FROM user_survey_responses
WHERE user_id = '<user_a_id>';
-- Expected: 1 row with completion_pct > 0

-- Check User B's data is empty
SELECT user_id, completion_pct
FROM user_survey_responses
WHERE user_id = '<user_b_id>';
-- Expected: 1 row with completion_pct = 0

-- Verify they're different users
SELECT COUNT(DISTINCT user_id)
FROM user_survey_responses;
-- Expected: At least 2
```

---

## ⏱️ Total Test Time: ~5 minutes

1. Set up (2 windows) - 30 sec
2. User A fills survey - 2 min
3. Sign out / Sign in as User B - 1 min
4. Verify empty survey - 30 sec
5. Check terminal logs - 1 min

**Done!** ✅

---

## 📝 Quick Checklist

```
□ Terminal shows different user IDs for A and B
□ User B gets "No existing data found" message
□ User B's survey starts at Q1
□ No pre-filled answers in User B's survey
□ Console shows correct user_id in all operations
□ No errors in terminal or browser console
```

If all checkboxes pass → ✅ **FIX IS WORKING**

---

**Last Updated:** 2025-10-18
**Test Type:** Critical Security Test
**Estimated Time:** 5 minutes
**Status:** Ready for Testing
