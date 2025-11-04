# 🐛 Onboarding Loop Debug Plan

**User:** raunek@cloudsteer.com
**Issue:** Stuck in onboarding loop, cannot access dashboard on Vercel
**Date:** November 3, 2025

---

## 🔍 Problem Analysis

### Possible Root Causes

Based on code analysis, the onboarding loop can occur when:

1. **Partnership exists but survey incomplete**
   - User has partnership_members entry
   - Survey completion_pct < 100
   - Middleware blocks /dashboard access
   - Redirects to onboarding

2. **Survey complete but not reviewed**
   - Survey completion_pct = 100
   - User's survey_reviewed = false
   - Middleware blocks dashboard
   - Redirects to /onboarding/review-survey

3. **LocalStorage state mismatch**
   - flow.ts uses localStorage for onboarding state
   - localStorage may not match database state
   - getResumeStep() may return wrong path

4. **Middleware vs FlowController disagreement**
   - Middleware checks: partnership + survey completion + survey_reviewed
   - FlowController has different logic
   - They may redirect to different places

5. **Database state corruption**
   - Partnership exists but survey row missing
   - Survey exists but partnership_id is null
   - Survey_reviewed flag not set correctly

---

## 🎯 Systematic Debug Approach

### Phase 1: Inspect Database State (HIGHEST PRIORITY)

**Goal:** Understand the actual database state for raunek@cloudsteer.com

**Queries to Run in Supabase SQL Editor:**

```sql
-- 1. Find user ID
SELECT id, email, created_at
FROM auth.users
WHERE email = 'raunek@cloudsteer.com';
-- COPY THE USER ID FROM RESULT

-- 2. Check partnership membership
SELECT
  pm.user_id,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed,
  pm.survey_reviewed_at,
  pm.joined_at
FROM partnership_members pm
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'raunek@cloudsteer.com';

-- 3. Check partnership survey
SELECT
  usr.id,
  usr.partnership_id,
  usr.user_id,
  usr.completion_pct,
  usr.current_step,
  usr.completed_sections,
  usr.created_at,
  usr.updated_at
FROM user_survey_responses usr
JOIN partnership_members pm ON pm.partnership_id = usr.partnership_id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'raunek@cloudsteer.com';

-- 4. Check if there's also a user-based survey (shouldn't exist)
SELECT
  usr.id,
  usr.partnership_id,
  usr.user_id,
  usr.completion_pct
FROM user_survey_responses usr
JOIN auth.users u ON u.id = usr.user_id
WHERE u.email = 'raunek@cloudsteer.com';

-- 5. Check partnership details
SELECT
  p.id,
  p.tier,
  p.owner_id,
  p.created_at,
  COUNT(pm.user_id) as member_count
FROM partnerships p
JOIN partnership_members pm ON pm.partnership_id = p.id
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'raunek@cloudsteer.com'
GROUP BY p.id, p.tier, p.owner_id, p.created_at;
```

**Expected Results:**

✅ **Healthy State:**
- partnership_members: 1 row, role='owner', survey_reviewed=true
- user_survey_responses: 1 row, partnership_id=X, user_id=null, completion_pct=100
- No user-based survey (user_id should be null)

❌ **Problem States:**

**State A: Survey incomplete**
- completion_pct < 100
- **Fix:** Complete survey or manually set to 100

**State B: Survey complete but not reviewed**
- completion_pct = 100
- survey_reviewed = false
- **Fix:** Run markSurveyReviewed() or manually update

**State C: Dual survey corruption**
- Both user_id and partnership_id surveys exist
- **Fix:** Delete user-based survey, keep partnership one

**State D: No partnership**
- No partnership_members row
- **Fix:** Create partnership + member entry

---

### Phase 2: Check Middleware Logs (Vercel)

**Goal:** See what middleware is actually doing

**Steps:**
1. Go to Vercel dashboard
2. Find latest deployment
3. Click "Functions" tab
4. Click "Logs"
5. Filter for user ID or email
6. Look for middleware logs with patterns:
   - `[Middleware] ===== PROTECTED ROUTE CHECK =====`
   - `[Middleware] Partnership membership:`
   - `[Middleware] Partnership survey check:`

**What to Look For:**
- Is middleware finding the partnership?
- What is survey completion_pct?
- What is survey_reviewed value?
- Where is it redirecting to?

---

### Phase 3: Clear LocalStorage (Client-Side)

**Goal:** Remove stale onboarding state

**Steps:**
1. Open browser DevTools (F12)
2. Go to Application tab
3. Expand "Local Storage"
4. Find your Vercel domain
5. Look for keys like `onboarding_state_<USER_ID>`
6. Delete all onboarding-related keys
7. Also delete `haevn_onboarding` if present
8. Refresh page

**Why This Helps:**
- flow.ts uses localStorage for onboarding state
- Stale localStorage can override database state
- Clearing forces fresh state from database

---

### Phase 4: Test FlowController Behavior

**Goal:** See what getResumeStep() returns for your user

**Add Temporary Debug Code:**

In `lib/onboarding/flow.ts`, line 230, add console logs:

```typescript
async getResumeStep(userId: string): Promise<string> {
  try {
    console.log('[FlowController] ===== DEBUG START =====')
    console.log('[FlowController] User ID:', userId)

    // ... existing code ...

    console.log('[FlowController] Final decision:', resumePath)
    console.log('[FlowController] ===== DEBUG END =====')
    return resumePath
  }
}
```

Deploy and check Vercel logs for these debug statements.

---

### Phase 5: Quick Fixes (Database)

**If database state is corrupted, run these fixes:**

**Fix A: Mark survey as reviewed**
```sql
UPDATE partnership_members
SET
  survey_reviewed = true,
  survey_reviewed_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'raunek@cloudsteer.com'
);
```

**Fix B: Set survey to 100% complete**
```sql
UPDATE user_survey_responses
SET
  completion_pct = 100,
  updated_at = NOW()
WHERE partnership_id = (
  SELECT partnership_id
  FROM partnership_members pm
  JOIN auth.users u ON u.id = pm.user_id
  WHERE u.email = 'raunek@cloudsteer.com'
);
```

**Fix C: Delete user-based survey (if exists)**
```sql
DELETE FROM user_survey_responses
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'raunek@cloudsteer.com'
)
AND partnership_id IS NULL;
```

**Fix D: Create missing partnership (if needed)**
```sql
-- First create partnership
INSERT INTO partnerships (owner_id, tier, created_at, updated_at)
SELECT
  id,
  'free',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'raunek@cloudsteer.com'
RETURNING id;

-- Then create membership (replace PARTNERSHIP_ID with ID from above)
INSERT INTO partnership_members (
  user_id,
  partnership_id,
  role,
  survey_reviewed,
  survey_reviewed_at,
  joined_at
)
SELECT
  id,
  'PARTNERSHIP_ID_HERE',
  'owner',
  true,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'raunek@cloudsteer.com';
```

---

## 🔧 Decision Tree

```
START
  |
  ├─ Run Phase 1 database queries
  │   |
  │   ├─ No partnership found?
  │   │   └─> Run Fix D (create partnership)
  │   │
  │   ├─ Survey completion_pct < 100?
  │   │   └─> Run Fix B (set to 100%)
  │   │
  │   ├─ survey_reviewed = false?
  │   │   └─> Run Fix A (mark as reviewed)
  │   │
  │   ├─ Both user_id and partnership_id surveys exist?
  │   │   └─> Run Fix C (delete user-based)
  │   │
  │   └─ All checks pass?
  │       └─> Continue to Phase 2
  │
  ├─ Run Phase 2 (check Vercel logs)
  │   |
  │   └─ Middleware redirecting incorrectly?
  │       └─> Check middleware logic vs database state
  │
  ├─ Run Phase 3 (clear localStorage)
  │   |
  │   └─> Refresh and test dashboard access
  │
  └─ Still broken?
      └─> Run Phase 4 (add debug logs and redeploy)
```

---

## ✅ Success Criteria

Dashboard access works when:

1. **Database State:**
   - ✅ partnership_members row exists
   - ✅ survey_reviewed = true
   - ✅ user_survey_responses.completion_pct = 100
   - ✅ user_survey_responses.partnership_id is set
   - ✅ No user-based survey (user_id null)

2. **Middleware Check:**
   - ✅ Finds partnership membership
   - ✅ Sees completion_pct = 100
   - ✅ Sees survey_reviewed = true
   - ✅ Allows access to /dashboard

3. **FlowController:**
   - ✅ getResumeStep() returns '/dashboard'
   - ✅ Does not redirect to onboarding

4. **Client:**
   - ✅ No localStorage conflicts
   - ✅ Dashboard page renders
   - ✅ No redirect loops

---

## 📊 Root Cause Hypothesis (Most Likely)

Based on the code, the most likely cause is:

**Hypothesis: User created account BEFORE Phase 1 migrations**

If raunek@cloudsteer.com signed up before Phase 1 was deployed:
- ❌ No partnership was created (partnerships didn't exist yet)
- ❌ Survey saved with user_id, not partnership_id
- ❌ No survey_reviewed flag (column didn't exist)

**This explains:**
- Middleware blocks dashboard (no partnership found)
- FlowController redirects to onboarding/expectations
- Survey data exists but wrong format

**Solution:**
Run the backfill migration manually for this user OR apply Fixes A+B+D.

---

## 🚀 Recommended Action Plan

1. **Run Phase 1 queries** (5 minutes)
2. **Identify specific issue** from query results
3. **Apply appropriate Fix** (A, B, C, or D)
4. **Clear localStorage** in browser
5. **Test dashboard access**
6. **If still broken:** Check Vercel logs (Phase 2)
7. **If still broken:** Add debug logs (Phase 4)

---

*Generated by Claude Code on November 3, 2025*
