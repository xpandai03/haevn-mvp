# Phase 1 Testing & Verification Guide

**Date:** November 3, 2025
**Build:** Commit `809a4bb`
**Status:** Ready for QA

---

## 🔍 STEP 1: Database Migration Validation

### 1.1 Verify Column Existence

Run these queries in Supabase SQL Editor:

```sql
-- Check user_survey_responses columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_survey_responses'
  AND column_name IN ('user_id', 'partnership_id')
ORDER BY column_name;

-- Expected output:
-- column_name      | data_type | is_nullable | column_default
-- -----------------|-----------|-------------|---------------
-- partnership_id   | uuid      | YES         | NULL
-- user_id          | uuid      | YES         | NULL
```

```sql
-- Check partnership_members columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'partnership_members'
  AND column_name LIKE 'survey%'
ORDER BY column_name;

-- Expected output:
-- column_name         | data_type                | is_nullable | column_default
-- --------------------|--------------------------|-------------|---------------
-- survey_reviewed     | boolean                  | YES         | false
-- survey_reviewed_at  | timestamp with time zone | YES         | NULL
```

### 1.2 Verify Indexes Created

```sql
-- Check for new indexes
SELECT indexname, tablename, indexdef
FROM pg_indexes
WHERE tablename IN ('user_survey_responses', 'partnership_members')
  AND indexname LIKE '%survey%'
ORDER BY tablename, indexname;

-- Expected output should include:
-- idx_user_survey_responses_partnership
-- idx_partnership_members_survey_reviewed
```

### 1.3 Verify Constraints

```sql
-- Check the ownership constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'user_survey_responses'::regclass
  AND conname = 'user_survey_responses_ownership_check';

-- Expected output:
-- conname: user_survey_responses_ownership_check
-- constraint_def: CHECK (((user_id IS NOT NULL) AND (partnership_id IS NULL)) OR ((user_id IS NULL) AND (partnership_id IS NOT NULL)))
```

### 1.4 Verify RLS Policies

```sql
-- List all RLS policies on user_survey_responses
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_survey_responses'
ORDER BY policyname;

-- Expected policies:
-- survey_select_policy (SELECT)
-- survey_insert_policy (INSERT)
-- survey_update_policy (UPDATE)
-- survey_delete_policy (DELETE)
```

### 1.5 Verify Database Functions

```sql
-- Check trigger function exists
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_name IN ('auto_mark_owner_survey_reviewed', 'is_partnership_survey_reviewed')
ORDER BY routine_name;

-- Check trigger exists
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_name = 'on_partnership_member_insert';
```

### 1.6 Verify Backfill Results

```sql
-- Check survey migration status
SELECT
  COUNT(*) as total_surveys,
  COUNT(user_id) as user_based_surveys,
  COUNT(partnership_id) as partnership_based_surveys,
  COUNT(CASE WHEN user_id IS NOT NULL AND partnership_id IS NOT NULL THEN 1 END) as invalid_both,
  COUNT(CASE WHEN user_id IS NULL AND partnership_id IS NULL THEN 1 END) as invalid_neither
FROM user_survey_responses;

-- Expected:
-- - invalid_both = 0
-- - invalid_neither = 0
-- - Most surveys should be partnership_based after migration
```

```sql
-- Check which surveys got migrated to partnerships
SELECT
  usr.user_id,
  usr.partnership_id,
  pm.role,
  usr.completion_pct,
  pm.survey_reviewed
FROM user_survey_responses usr
LEFT JOIN partnership_members pm ON usr.partnership_id = pm.partnership_id
WHERE usr.partnership_id IS NOT NULL
ORDER BY usr.created_at DESC
LIMIT 10;

-- Verify:
-- - Owners have survey_reviewed = true
-- - partnership_id matches user's membership
```

### 1.7 Check Review Status

```sql
-- Check partnership review status
SELECT
  p.id as partnership_id,
  p.owner_id,
  COUNT(pm.user_id) as total_members,
  COUNT(CASE WHEN pm.survey_reviewed THEN 1 END) as reviewed_members,
  is_partnership_survey_reviewed(p.id) as fully_reviewed,
  usr.completion_pct as survey_completion
FROM partnerships p
LEFT JOIN partnership_members pm ON p.id = pm.partnership_id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = p.id
GROUP BY p.id, p.owner_id, usr.completion_pct
ORDER BY p.created_at DESC
LIMIT 10;

-- Verify:
-- - All owners (existing users) have reviewed_members >= 1
-- - Fully_reviewed matches expectation based on member count
```

---

## ✅ STEP 2: Functional QA - Test Cases

### 2.1 Solo User Flow (Baseline)

**Test ID:** SOLO-001
**Description:** New user signs up without invite code

**Steps:**
1. Open incognito browser window
2. Navigate to: `https://your-app.vercel.app/auth/signup`
3. Fill out signup form (no invite code in URL)
4. Submit form
5. Observe redirect after signup
6. Complete onboarding flow
7. Fill out survey to 100%
8. Access dashboard

**Expected Results:**
- ✅ Redirects to `/onboarding/expectations` (NOT `/onboarding/accept-invite`)
- ✅ Survey saves successfully
- ✅ Can complete survey to 100%
- ✅ Middleware allows dashboard access
- ✅ User is auto-created as partnership owner
- ✅ `survey_reviewed` = true automatically

**Verification Query:**
```sql
-- Replace 'user-email@example.com' with test user email
SELECT
  u.email,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed,
  usr.completion_pct,
  usr.partnership_id as survey_partnership_id
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = pm.partnership_id
WHERE u.email = 'user-email@example.com';

-- Expected:
-- role = 'owner'
-- survey_reviewed = true
-- completion_pct = 100
-- survey_partnership_id = pm.partnership_id
```

**Browser Console Logs to Check:**
- `[Signup] Redirecting to expectations (no invite)`
- `[saveUserSurveyData] Partnership ID: xxx`
- `[saveUserSurveyData] Auto-marking owner as reviewed`
- `[Middleware] ✅ All checks passed, allowing access`

---

### 2.2 Owner Creates Invite

**Test ID:** INVITE-001
**Description:** Existing user creates partnership invitation

**Manual Setup (SQL):**
```sql
-- Get the partnership_id for your test user
SELECT pm.partnership_id, pm.user_id
FROM partnership_members pm
JOIN auth.users u ON u.id = pm.user_id
WHERE u.email = 'owner@example.com' AND pm.role = 'owner';

-- Create a test invite (use partnership_id from above)
INSERT INTO partnership_requests (
  from_user_id,
  to_email,
  partnership_id,
  invite_code,
  status,
  created_at
) VALUES (
  'owner-user-id-from-query-above',
  'partner@example.com',
  'partnership-id-from-query-above',
  'TEST01',
  'pending',
  NOW()
) RETURNING *;
```

**Expected Results:**
- ✅ Invite record created successfully
- ✅ Status = 'pending'
- ✅ Invite code is unique (TEST01)

---

### 2.3 Partner Signup with Invite

**Test ID:** PARTNER-001
**Description:** New user signs up using invite link

**Steps:**
1. Open NEW incognito window (different from owner)
2. Navigate to: `https://your-app.vercel.app/auth/signup?invite=TEST01`
3. Fill out signup form with `partner@example.com`
4. Submit form
5. Observe redirect

**Expected Results:**
- ✅ Invite code detected and stored in localStorage
- ✅ Redirects to `/onboarding/accept-invite` (NOT `/onboarding/expectations`)
- ✅ Shows owner's name and details
- ✅ Shows survey completion percentage
- ✅ Shows city information

**Browser Console Logs:**
- `[Signup] Invite code detected: TEST01`
- `[Signup] Redirecting to accept-invite (invite code present)`

**Verification Query:**
```sql
-- Check invite code is in localStorage (browser dev tools)
localStorage.getItem('haevn_invite_code') // Should return "TEST01"
```

---

### 2.4 Partner Accepts Invite

**Test ID:** PARTNER-002
**Description:** Partner accepts partnership invitation

**Steps:**
1. On `/onboarding/accept-invite` page
2. Verify invite details displayed correctly
3. Click "Join Partnership & Review Survey" button
4. Observe redirect

**Expected Results:**
- ✅ partnership_member record created (role='member')
- ✅ Invite status updated to 'accepted'
- ✅ Redirects to `/onboarding/review-survey`
- ✅ Toast notification: "Partnership joined!"
- ✅ localStorage invite code cleared

**Browser Console Logs:**
- `[AcceptInvite] Accepting invite with code: TEST01`
- `[AcceptInvite] Invite accepted successfully`

**Verification Query:**
```sql
-- Check partnership membership
SELECT
  u.email,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed,
  pm.joined_at
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
WHERE u.email = 'partner@example.com';

-- Expected:
-- role = 'member'
-- survey_reviewed = false (not yet reviewed)
-- partnership_id matches owner's partnership

-- Check invite status
SELECT status, updated_at
FROM partnership_requests
WHERE invite_code = 'TEST01';

-- Expected: status = 'accepted'
```

---

### 2.5 Partner Reviews Survey

**Test ID:** PARTNER-003
**Description:** Partner reviews and approves survey

**Steps:**
1. On `/onboarding/review-survey` page
2. Verify survey answers are displayed
3. Verify completion percentage shown
4. Click "Edit Survey" button (optional test)
5. Check "I have reviewed and approve these responses" checkbox
6. Click "Approve & Continue to Dashboard" button
7. Observe redirect

**Expected Results:**
- ✅ Survey answers loaded and displayed
- ✅ Completion percentage correct (100% if owner completed)
- ✅ "Approve" button disabled until checkbox checked
- ✅ "Approve" button disabled if survey < 100%
- ✅ After approval, `survey_reviewed` set to true
- ✅ Redirects to `/dashboard`
- ✅ Toast notification: "Survey approved!"

**Browser Console Logs:**
- `[ReviewSurvey] Partnership ID: xxx`
- `[ReviewSurvey] Survey data loaded`
- `[ReviewSurvey] Marking survey as reviewed`

**Verification Query:**
```sql
-- Check review status updated
SELECT
  u.email,
  pm.survey_reviewed,
  pm.survey_reviewed_at,
  usr.completion_pct
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
LEFT JOIN user_survey_responses usr ON usr.partnership_id = pm.partnership_id
WHERE u.email = 'partner@example.com';

-- Expected:
-- survey_reviewed = true
-- survey_reviewed_at = (recent timestamp)
-- completion_pct = 100
```

---

### 2.6 Dashboard Access Control

**Test ID:** ACCESS-001
**Description:** Both partners can access dashboard

**Test A - Owner Access:**
1. Login as owner@example.com
2. Navigate to `/dashboard`
3. Verify access granted

**Test B - Partner Access:**
1. Login as partner@example.com
2. Navigate to `/dashboard`
3. Verify access granted

**Expected Results:**
- ✅ Both users can access `/dashboard`
- ✅ Both see identical data (partnership-centric)
- ✅ No redirect to onboarding
- ✅ Middleware logs show: "✅ All checks passed"

**Verification Query:**
```sql
-- Check both users in same partnership
SELECT
  u.email,
  pm.partnership_id,
  pm.role,
  pm.survey_reviewed
FROM auth.users u
JOIN partnership_members pm ON pm.user_id = u.id
WHERE u.email IN ('owner@example.com', 'partner@example.com')
ORDER BY pm.role;

-- Expected:
-- Same partnership_id for both
-- Both have survey_reviewed = true
```

---

### 2.7 Middleware Validation

**Test ID:** MIDDLEWARE-001
**Description:** Middleware blocks incomplete users

**Test A - Partner NOT Reviewed:**
1. Manually set partner's `survey_reviewed = false`
2. Login as partner
3. Try to access `/dashboard`

```sql
-- Temporarily set to false for testing
UPDATE partnership_members
SET survey_reviewed = false
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'partner@example.com');
```

**Expected Results:**
- ✅ Redirected to `/onboarding/review-survey`
- ✅ Cannot access dashboard
- ✅ Middleware logs: "❌ Survey incomplete or not reviewed"

**Test B - Survey Incomplete:**
1. Create new user with incomplete survey (< 100%)
2. Try to access `/dashboard`

**Expected Results:**
- ✅ Redirected to `/onboarding/survey`
- ✅ Cannot access dashboard

**Cleanup:**
```sql
-- Reset partner's review status
UPDATE partnership_members
SET survey_reviewed = true,
    survey_reviewed_at = NOW()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'partner@example.com');
```

---

## 🐛 STEP 3: Edge Case Testing

### 3.1 Invalid Invite Code

**Test ID:** EDGE-001
**Steps:**
1. Navigate to: `https://your-app.vercel.app/auth/signup?invite=INVALID`
2. Complete signup
3. Observe behavior

**Expected Results:**
- ✅ Redirects to `/onboarding/accept-invite`
- ✅ Shows error: "Invalid or expired invite code"
- ✅ Provides "Continue Without Invite" button
- ✅ Clicking button redirects to `/onboarding/expectations`

---

### 3.2 User Already in Partnership

**Test ID:** EDGE-002
**Steps:**
1. Try to accept invite while already a partnership member
2. Use existing owner's account to accept another invite

**Expected Results:**
- ✅ Shows error: "You are already in a partnership"
- ✅ Prevents duplicate membership
- ✅ Invite status remains 'pending'

---

### 3.3 Partner Joins Before Owner Completes Survey

**Test ID:** EDGE-003
**Setup:**
```sql
-- Set owner's survey to incomplete
UPDATE user_survey_responses
SET completion_pct = 50
WHERE partnership_id = 'test-partnership-id';
```

**Steps:**
1. Partner accepts invite
2. Goes to `/onboarding/review-survey`
3. Observes survey state

**Expected Results:**
- ✅ Shows warning: "Survey Incomplete: Your partner hasn't finished"
- ✅ Shows 50% completion
- ✅ "Approve" button disabled
- ✅ "Edit Survey" button available to help complete

---

### 3.4 Concurrent Survey Editing

**Test ID:** EDGE-004
**Steps:**
1. Open survey page as owner in one browser
2. Open same survey as partner in another browser
3. Both make changes and save

**Expected Results:**
- ✅ Last save wins (expected behavior for Phase 1)
- ✅ No data corruption
- ✅ Both users see updated answers after page refresh

**Note:** Real-time conflict resolution planned for Phase 2

---

### 3.5 Direct URL Access

**Test ID:** EDGE-005
**Test A - Unauthenticated:**
1. In incognito window (not logged in)
2. Navigate to `/onboarding/review-survey`

**Expected:**
- ✅ Redirected to `/auth/login`

**Test B - Authenticated but No Partnership:**
1. Login as user without partnership
2. Navigate to `/onboarding/review-survey`

**Expected:**
- ✅ Redirected to `/onboarding/expectations`

**Test C - Authenticated, Partner, Already Reviewed:**
1. Login as partner who already reviewed
2. Navigate to `/onboarding/review-survey`

**Expected:**
- ✅ Redirected to `/dashboard`
- ✅ Toast: "Survey already reviewed"

---

## 📊 STEP 4: Test Results Summary

### Database Validation Results

| Check | Status | Notes |
|-------|--------|-------|
| `partnership_id` column exists | ⬜ Pass / ❌ Fail | |
| `survey_reviewed` columns exist | ⬜ Pass / ❌ Fail | |
| Indexes created | ⬜ Pass / ❌ Fail | |
| Ownership constraint active | ⬜ Pass / ❌ Fail | |
| RLS policies updated | ⬜ Pass / ❌ Fail | |
| Trigger function exists | ⬜ Pass / ❌ Fail | |
| Backfill completed | ⬜ Pass / ❌ Fail | |
| No invalid surveys (both IDs) | ⬜ Pass / ❌ Fail | |

### Functional Test Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| SOLO-001 | Solo user signup | ⬜ Pass / ❌ Fail | |
| INVITE-001 | Owner creates invite | ⬜ Pass / ❌ Fail | |
| PARTNER-001 | Partner signup with invite | ⬜ Pass / ❌ Fail | |
| PARTNER-002 | Partner accepts invite | ⬜ Pass / ❌ Fail | |
| PARTNER-003 | Partner reviews survey | ⬜ Pass / ❌ Fail | |
| ACCESS-001 | Dashboard access (both) | ⬜ Pass / ❌ Fail | |
| MIDDLEWARE-001 | Middleware validation | ⬜ Pass / ❌ Fail | |

### Edge Case Results

| Test ID | Test Name | Status | Notes |
|---------|-----------|--------|-------|
| EDGE-001 | Invalid invite code | ⬜ Pass / ❌ Fail | |
| EDGE-002 | Duplicate membership | ⬜ Pass / ❌ Fail | |
| EDGE-003 | Incomplete survey | ⬜ Pass / ❌ Fail | |
| EDGE-004 | Concurrent editing | ⬜ Pass / ❌ Fail | |
| EDGE-005 | Direct URL access | ⬜ Pass / ❌ Fail | |

---

## 🐛 Bug Report Template

```markdown
### Bug ID: BUG-XXX
**Severity:** 🔴 Critical / 🟡 Major / 🟢 Minor
**Test ID:** PARTNER-001
**Environment:** Production / Staging
**Browser:** Chrome 120 / Safari 17 / etc.

**Description:**
[What went wrong]

**Steps to Reproduce:**
1. Step 1
2. Step 2
3. Step 3

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happened]

**Screenshots:**
[Attach if relevant]

**Console Logs:**
```
[Error logs from browser console]
```

**Database State:**
```sql
-- Query showing relevant data
```

**Proposed Fix:**
[If you have suggestions]

**Workaround:**
[Temporary solution if any]
```

---

## 🎯 Pass/Fail Criteria

### ✅ **Phase 1 PASSES if:**
- All database validations pass
- Solo user flow works (SOLO-001 passes)
- Owner → Partner invite flow works (INVITE-001, PARTNER-001/002/003 pass)
- Both partners can access dashboard (ACCESS-001 passes)
- Middleware correctly blocks incomplete users (MIDDLEWARE-001 passes)
- At least 80% of edge cases handled gracefully

### ❌ **Phase 1 FAILS if:**
- Data corruption occurs (invalid surveys with both IDs)
- Solo users cannot complete onboarding
- Partners cannot join partnerships
- Dashboard access broken for either partner
- Middleware allows access to incomplete users
- Critical bugs block core functionality

---

## 📝 Next Steps Based on Results

### If All Tests Pass:
1. Mark Phase 1 as **Production Ready**
2. Begin Phase 2 planning (dashboard updates)
3. Add invite creation UI to dashboard
4. Plan email notification system

### If Major Bugs Found:
1. Create hotfix branch
2. Fix critical issues
3. Re-test affected flows
4. Deploy hotfix
5. Re-run full test suite

### If Minor Issues Found:
1. Document in GitHub Issues
2. Prioritize for Phase 1.1 or Phase 2
3. Create workaround documentation
4. Proceed with Phase 2 planning

---

## 📞 Support & Questions

If you encounter issues during testing:
1. Check browser console for error logs
2. Run verification SQL queries
3. Check Vercel deployment logs
4. Review `PHASE1_IMPLEMENTATION_COMPLETE.md` for architecture details

**Testing completed by:** [Your Name]
**Date:** [Date]
**Overall Result:** ⬜ PASS / ❌ FAIL
**Notes:** [Additional observations]
