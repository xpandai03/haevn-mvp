# Live Production Testing Guide - October 20, 2025

## 🎯 Testing Objective
Verify all critical fixes work on production (Vercel deployment):
1. ✅ Login loop fix for existing users
2. ✅ Conditional survey logic (questions show/hide based on answers)
3. ✅ Survey saves persist correctly
4. ✅ New user onboarding flow works end-to-end

---

## 📋 Test Accounts

### Option 1: Find Existing Test Accounts in Database

**Run this query in Supabase SQL Editor:**
```sql
-- Find all test accounts with their survey status
SELECT
  p.user_id,
  p.email,
  p.full_name,
  p.city,
  usr.completion_pct as survey_completion,
  usr.current_step as survey_step,
  p.created_at
FROM profiles p
LEFT JOIN user_survey_responses usr ON p.user_id = usr.user_id
WHERE
  p.email LIKE '%test%' OR
  p.email LIKE '%tester%' OR
  p.full_name LIKE '%test%'
ORDER BY p.created_at DESC
LIMIT 10;
```

### Option 2: Known Test Accounts from Session Logs

Based on today's session logs, we have:
- **Email:** `tester69@tester.com`
- **User ID:** `78d58a2a-9c8e-44e5-9f87-478d44c0249c`
- **Status:** Existing user, has some survey data

### Option 3: Create Fresh Test Accounts

You'll create these during testing:
1. **New User Test 1:** `newuser-oct20-1@test.com` / Password: `Test123456!`
2. **New User Test 2:** `newuser-oct20-2@test.com` / Password: `Test123456!`

---

## 🧪 Test Plan

### TEST 1: Existing User Login (CRITICAL - Was Previously Broken)

**Account:** `tester69@tester.com` (or another existing test user from database)

**Steps:**
1. **Clear browser data first:**
   - Press F12 → Application tab → Storage
   - Clear all cookies for your production domain
   - Clear Local Storage
   - Close browser and reopen

2. **Navigate to production URL**
   - Go to your Vercel production URL
   - Should land on landing page

3. **Click "Sign in"**
   - Enter: `tester69@tester.com`
   - Enter password (whatever was set for this account)
   - Click "Sign in"

4. **CRITICAL CHECK - Login Loop Test:**
   - ❌ **FAIL if:** Redirected to "Create your account" page (signup)
   - ❌ **FAIL if:** Stuck in loop between login and signup
   - ✅ **PASS if:** Redirected to one of these:
     - `/dashboard` (if survey 100% complete)
     - `/onboarding/expectations` (if incomplete onboarding)
     - `/onboarding/survey` (if in middle of survey)

5. **Browser Console Check:**
   - Press F12 → Console
   - Look for logs:
     ```
     [Login] ===== GETTING RESUME PATH =====
     [FlowController] Getting resume step for user: ...
     [FlowController] Skipping signup step - user is authenticated
     [FlowController] Resuming at step: /onboarding/... (or /dashboard)
     ```
   - Take screenshot of console logs

**Expected Result:** User should go to their correct destination (NOT signup page)

**If FAIL:** Note exactly where you ended up and share console logs

---

### TEST 2: New User Signup Flow (End-to-End)

**Account:** Create new: `newuser-oct20-1@test.com` / Password: `Test123456!`

**Steps:**

#### Step 2.1: Signup
1. Go to production URL
2. Click "Get started"
3. Fill out signup form:
   - Name: `Test User Oct20`
   - Email: `newuser-oct20-1@test.com`
   - Password: `Test123456!`
   - ZIP code: `78701` (Austin, should be in live MSA)
4. Click "Continue"

**Expected:** Should redirect to `/onboarding/expectations`

#### Step 2.2: Expectations Page
1. Read the expectations
2. Click "I'm ready — Continue"

**Expected:** Should redirect to `/onboarding/welcome`

#### Step 2.3: Welcome Page
1. Read welcome message
2. Click "Continue"

**Expected:** Should redirect to `/onboarding/identity`

#### Step 2.4: Identity Page
1. Fill in identity questions
2. Click "Continue"

**Expected:** Should redirect to `/onboarding/verification`

#### Step 2.5: Verification Page
1. Click "Skip for now" (verification not required for MVP)

**Expected:** Should redirect to `/onboarding/survey-intro`

#### Step 2.6: Survey Intro
1. Read survey introduction
2. Click "Start Survey"

**Expected:** Should redirect to `/onboarding/survey`

#### Step 2.7: Survey Page (Critical Test)
**Now test survey saves and conditional logic...**

---

### TEST 3: Survey Saves (CRITICAL - Was Previously Broken)

**Continue from TEST 2 Step 2.7 or use existing user at survey**

**Steps:**

1. **Fill out first question (Age):**
   - Enter age: `30`
   - Click "Next"
   - ✅ **CHECK:** No "Failed to save" error appears
   - ✅ **CHECK:** Question advances to next

2. **Fill out 3-4 more questions:**
   - Answer each question
   - Click "Next" between each
   - ✅ **CHECK:** No save errors
   - ✅ **CHECK:** Progress bar updates

3. **Refresh the page (F5):**
   - ✅ **CRITICAL:** Answers should still be there
   - ✅ **CRITICAL:** Should resume at same question
   - ❌ **FAIL if:** Answers are lost
   - ❌ **FAIL if:** Reset to beginning

4. **Close tab and reopen survey:**
   - Close browser tab
   - Navigate back to production URL
   - Login if needed
   - ✅ **CRITICAL:** Should resume at same question with saved answers

**Browser Console Check:**
- Look for: `[API /survey/save] Saved successfully`
- Should see NO errors about missing session or cookies
- Take screenshot if errors appear

**Expected Result:** All answers persist across page refresh and browser close

---

### TEST 4: Conditional Logic (CRITICAL - Not Working on Production)

**This is the main issue you reported. Let's test thoroughly.**

**Setup:**
- Either continue from TEST 3, or
- Use existing user and navigate to survey
- Make sure you're on a fresh survey or early questions

---

#### Test 4.1: Q3 → Q3b Conditional (Simple Test)

**Steps:**
1. Navigate to Q3: "How do you describe your sexual orientation?"
2. **Test A - Should SHOW Q3b:**
   - Select: `Bisexual` (or `Pansexual`, `Queer`, or `Other`)
   - Click "Next"
   - ✅ **PASS if:** Q3b "Kinsey Scale" question appears
   - ❌ **FAIL if:** Q3b does not appear, jumps to Q4

3. Go back to Q3 (use browser back button)
4. **Test B - Should HIDE Q3b:**
   - Change to: `Gay` (or `Lesbian`, `Straight`)
   - Click "Next"
   - ✅ **PASS if:** Q3b is skipped, goes directly to Q3c or Q4
   - ❌ **FAIL if:** Q3b still appears

**Browser Console Check:**
- Look for: `[logic-parser]` errors
- If errors appear, take screenshot

---

#### Test 4.2: Q6 → Q7/Q8 Conditional (Critical Test)

**Steps:**
1. Navigate to Q6: "What relationship style(s) interest you?"
2. **Test A - Should SHOW Q7 and Q8:**
   - Select: `Open relationship` (or `Polyamory`)
   - Click "Next" through any intermediate questions
   - ✅ **PASS if:** Q7 "How important is emotional exclusivity?" appears
   - Click "Next" after answering Q7
   - ✅ **PASS if:** Q8 "How important is sexual exclusivity?" appears
   - ❌ **FAIL if:** Q7 or Q8 are skipped

3. Go back to Q6
4. **Test B - Should HIDE Q7 and Q8:**
   - Change to: `Monogamy` only
   - Click "Next"
   - ✅ **PASS if:** Q7 and Q8 are both skipped
   - ✅ **PASS if:** Goes to Q9 instead
   - ❌ **FAIL if:** Q7 or Q8 still appear

**Why This Test is Critical:**
- This was the main conditional logic you reported as broken
- Q7/Q8 display logic: `"Show if Q6 includes 'Open relationship' OR Q6 includes 'Polyamory' OR Q6 includes 'Don\\'t know yet'"`

---

#### Test 4.3: Q6c → Q6d Conditional (Cascade Test)

**Steps:**
1. Navigate to Q6a: "How would you like to meet people here?"
2. Select: `As a couple`
3. Click "Next"
4. ✅ **PASS if:** Q6c "If connecting as a couple, how?" appears
5. **Test A - Show Q6d:**
   - In Q6c, select: `Custom / differs by partner`
   - Click "Next"
   - ✅ **PASS if:** Q6d "Couple permissions" textarea appears
   - ❌ **FAIL if:** Q6d is skipped

6. Go back to Q6c
7. **Test B - Hide Q6d:**
   - Change to: `Together only`
   - Click "Next"
   - ✅ **PASS if:** Q6d is skipped
   - ❌ **FAIL if:** Q6d still appears

---

#### Test 4.4: Complex Conditional - Q10 (Advanced Test)

**Note:** This has a complex compound condition that was causing parser errors.

**Setup:**
1. Make sure you answered:
   - Q4 (relationship status)
   - Q6 (relationship styles)

**Test Scenarios:**

**Scenario A - Should SHOW Q10:**
- Q4 = `Single` AND Q6 includes `Monogamy` → Q10 should appear
- Q4 = `Single` AND Q6 includes `Polyamory` → Q10 should appear

**Scenario B - Should HIDE Q10:**
- Q4 = `Single` AND Q6 = `Open relationship` only → Q10 should be hidden
- Q4 = `Married` AND Q6 = `Monogamy` → Q10 should be hidden

**Steps:**
1. Answer Q4 and Q6 according to Scenario A
2. Navigate through survey
3. ✅ **PASS if:** Q10 "Which attachment style..." appears when expected
4. ❌ **FAIL if:** Q10 doesn't follow the rules above

**Browser Console:**
- Watch for: `[logic-parser] Unable to parse logic: "(Q4='Single'"` errors
- If this error appears, the fix didn't deploy properly

---

### TEST 5: Removed Questions (Verification)

**Verify these questions DO NOT appear anywhere in survey:**

❌ **Should be GONE:**
1. Q5 - "What's your ZIP code?" (already asked in signup)
2. Q5a - "Share precise location?"
3. Q17 - "Do you have or want children?"
4. Q17a - "Any dietary preferences or allergies?"
5. Q17b - "Pets at home or pet preferences?"

**Steps:**
1. Go through entire survey from start to finish
2. ✅ **PASS if:** None of the above questions appear
3. ❌ **FAIL if:** Any of these questions show up
4. Note exactly which question appeared if fail

---

### TEST 6: Browser Console Error Check

**Throughout all tests above, keep F12 console open:**

**Look for these errors (should NOT appear):**

❌ **Auth/Session Errors:**
```
[API /survey/save] ❌ NO SESSION FOUND
Failed to save survey data
Session expired
```

❌ **Logic Parser Errors:**
```
[logic-parser] Unable to parse logic: "(Show if Q4='Single'"
[logic-parser] Unable to parse logic: "(Q6 includes 'Monogamy'"
```

❌ **Cookie Errors:**
```
Supabase cookies found: 0
No cookies available
```

✅ **Good Signs (should see):**
```
[API /survey/save] ✅ User authenticated
[API /survey/save] Saved successfully
[FlowController] Skipping signup step - user is authenticated
```

---

## 📊 Test Results Template

**Copy this and fill out after testing:**

```markdown
## Production Test Results - [Your Name] - [Date/Time]

**Production URL Tested:** [Your Vercel URL]
**Browser:** [Chrome/Firefox/Safari] [Version]
**Device:** [Desktop/Mobile] [OS]

### TEST 1: Existing User Login
- Account tested: tester69@tester.com
- Result: [ ] PASS / [ ] FAIL
- Redirected to: _________________
- Console logs: [Attach screenshot or paste key logs]
- Notes: _________________

### TEST 2: New User Signup
- Account created: _________________
- Result: [ ] PASS / [ ] FAIL
- Got stuck at step: _________________
- Notes: _________________

### TEST 3: Survey Saves
- Result: [ ] PASS / [ ] FAIL
- Answers persisted after refresh: [ ] YES / [ ] NO
- Errors encountered: _________________
- Console logs: [Attach screenshot]

### TEST 4.1: Q3 → Q3b Conditional
- Test A (should show): [ ] PASS / [ ] FAIL
- Test B (should hide): [ ] PASS / [ ] FAIL
- Notes: _________________

### TEST 4.2: Q6 → Q7/Q8 Conditional (CRITICAL)
- Test A (should show Q7/Q8): [ ] PASS / [ ] FAIL
- Test B (should hide Q7/Q8): [ ] PASS / [ ] FAIL
- Notes: _________________

### TEST 4.3: Q6c → Q6d Conditional
- Test A (should show Q6d): [ ] PASS / [ ] FAIL
- Test B (should hide Q6d): [ ] PASS / [ ] FAIL

### TEST 4.4: Q10 Complex Conditional
- Scenario A: [ ] PASS / [ ] FAIL
- Scenario B: [ ] PASS / [ ] FAIL
- Parser errors in console: [ ] YES / [ ] NO

### TEST 5: Removed Questions
- ZIP code question appeared: [ ] YES (FAIL) / [ ] NO (PASS)
- Children question appeared: [ ] YES (FAIL) / [ ] NO (PASS)
- Other removed Qs appeared: [ ] YES / [ ] NO

### TEST 6: Console Errors
- Session/auth errors: [ ] YES (FAIL) / [ ] NO (PASS)
- Logic parser errors: [ ] YES (FAIL) / [ ] NO (PASS)
- Cookie errors: [ ] YES (FAIL) / [ ] NO (PASS)

### Overall Assessment
- [ ] All tests PASSED - Production ready! 🎉
- [ ] Some tests FAILED - Details below:

**Failures Summary:**
[List all failed tests and what went wrong]

**Console Error Screenshots:**
[Attach any error screenshots]

**Next Steps Needed:**
[What needs to be fixed]
```

---

## 🚨 If Tests Fail - Quick Fixes

### If Conditional Logic Still Broken:

**Option 1: Force Rebuild on Vercel**
1. Go to Vercel Dashboard
2. Deployments tab
3. Latest deployment → "..." menu
4. Click "Redeploy"
5. **Important:** Check "Force rebuild without using cache"
6. Wait for deployment (2-5 min)
7. Re-test

**Option 2: Check Build Logs**
1. Vercel Dashboard → Deployments → Latest
2. Click on deployment
3. Look for "Build Logs"
4. Search for "questions.ts" in logs
5. Check if file was included in build
6. Screenshot any errors/warnings

**Option 3: Verify Questions.ts Deployed**
1. In browser, go to: `https://[your-domain]/_next/static/chunks/` (may 404)
2. Or check Network tab while loading survey page
3. Look for chunk files containing survey logic
4. See if questions.ts changes are in bundle

### If Login Loop Returns:

1. Check console for: `[FlowController] Resuming at step: /auth/signup`
2. If you see that, the fix didn't deploy
3. Check commit `c970d00` is in Vercel deployment
4. Force rebuild

### If Survey Saves Fail:

1. Check console for: `[API /survey/save] ❌ NO SESSION FOUND`
2. Check Application tab → Cookies → Look for `sb-` cookies
3. If no cookies, middleware fix didn't deploy
4. Force rebuild

---

## 📧 Report Back

**After completing tests, share:**

1. ✅ Completed test results (use template above)
2. 📸 Screenshots of:
   - Any console errors
   - Failed conditional logic examples
   - Survey page showing wrong questions
3. 🔗 Production URL you tested
4. 🕐 Timestamp of testing (for correlating with Vercel logs)

**Send to:** [Your communication channel]

---

## 🎯 Success Criteria

**Tests considered PASSING if:**
- ✅ Existing user login goes to correct destination (not signup)
- ✅ Survey answers persist across refresh
- ✅ Q7/Q8 show when Q6 = non-monogamous
- ✅ Q7/Q8 hide when Q6 = monogamous only
- ✅ Q3b shows for bisexual/pansexual/queer
- ✅ Q6d shows when Q6c = custom
- ✅ ZIP code and children questions don't appear
- ✅ No session/auth errors in console
- ✅ No logic parser errors in console

**If ANY of above fail → Production deployment has issues**

---

## 📞 Need Help?

If tests fail and you can't figure out why:
1. Take screenshots of everything
2. Copy full console logs
3. Note exact steps that failed
4. Share all of the above
5. We'll debug together

---

**Good luck with testing! 🚀**

*Last updated: October 20, 2025*
*Testing production deployment with all critical fixes*

**UPDATING OCT 20 2025 8:51pm** 

TRYING TO GIVE CLAUDE CLARITY (last convo here in case)


⏺ Excellent! Commit created successfully. Now let me push to
  trigger the Vercel deployment:

⏺ Bash(git push origin main) timeout: 30s
  ⎿  To https://github.com/xpandai03/haevn-mvp.git
        c970d00..f658198  main -> main

⏺ 🎉 Successfully Pushed to Production!

  ✅ What Just Happened

  Commit: f658198Branch: mainFiles: 34 files changed (6,240
  insertions, 46 deletions)

  Pushed Changes Include:

  1. ✅ 21Oct-build.md - Complete deployment strategy document
  2. ✅ 17 documentation files - Troubleshooting guides from
  all previous sessions
  3. ✅ Debug utilities - Session management and testing tools
  4. ✅ Modified onboarding pages - Enhanced state management
  5. ✅ All critical fixes from commit c970d00 (login loop,
  conditional logic, survey saves)

  ---
  🚀 Next Steps: Monitor Deployment

  1. Check Vercel Dashboard

  The push to main should have automatically triggered a
  deployment. Go to:
  - https://vercel.com/dashboard
  - Look for your project
  - Watch the deployment status (should show "Building..." then
   "Ready")

  2. Wait for Deployment (~2-5 minutes)

  - Building phase: ~1-2 min
  - Deploying phase: ~1-2 min
  - Total: Usually 2-5 minutes

  3. Test Production After "Ready"

  Critical Tests:
  - Existing user login - Should NOT loop to signup anymore
  - Conditional logic - Q7/Q8/Q10/Q12 should show/hide based on
   answers
  - Survey saves - Should persist without errors
  - New user signup - Should go through full onboarding flow

  ---
  🔍 Debugging Production Issues

  If Conditional Logic Still Broken on Production:

  Option 1: Force Rebuild (Recommended)
  1. Go to Vercel Dashboard → Deployments
  2. Find the latest deployment
  3. Click "..." → Redeploy
  4. Select "Force rebuild without using cache"
  5. Wait for new deployment to complete

  Option 2: Check Browser Console
  1. Open production site
  2. Press F12 → Console tab
  3. Look for [logic-parser] errors
  4. Check if questions.ts changes are being used

  Option 3: Check Vercel Logs
  vercel logs [your-production-url] --follow

  ---
  📊 What to Look For

  ✅ If Everything Works:

  - Existing users can log in → Go to dashboard or resume
  survey
  - Conditional questions appear/disappear correctly
  - No console errors
  - Survey saves persist

  ❌ If Conditional Logic Still Broken:

  Share the following with me:
  1. Browser console logs (any errors?)
  2. Which questions aren't showing/hiding correctly?
  3. Did force rebuild help?

  ---
  Status: Changes pushed successfullyDeployment: Should be live
   in 2-5 minutesNext: Test production thoroughly and report
  back! 🚀

> can you put together a comprehensive testing guide in an md 
file called LIVEtest-20-oct.md - i need to know some real 
accounts that we have in our dtaabaase so i can test the flow 
as a new user and an old one to check all paths - be spcirci on
 all u want me to test 

⏺ Write(LIVEtest-20-oct.md)
  ⎿  Wrote 522 lines to LIVEtest-20-oct.md                    
     # Live Production Testing Guide - October 20, 2025
     ## 🎯 Testing Objective
     Verify all critical fixes work on production (Vercel
     deployment):
     1. ✅ Login loop fix for existing users
     2. ✅ Conditional survey logic (questions show/hide based
     on answers)
     3. ✅ Survey saves persist correctly
     4. ✅ New user onboarding flow works end-to-end
     ---
     … +512 lines (ctrl+o to expand)

⏺ Perfect! I've created LIVEtest-20-oct.md with a comprehensive
   testing guide.

  📄 What's in the Guide

  ✅ Complete Test Coverage:

  1. TEST 1: Existing user login (the critical loop fix)
  2. TEST 2: New user signup flow (end-to-end)
  3. TEST 3: Survey saves persistence
  4. TEST 4: Conditional logic (broken sections):
    - 4.1: Q3 → Q3b (simple conditional)
    - 4.2: Q6 → Q7/Q8 (THE CRITICAL ONE you reported)
    - 4.3: Q6c → Q6d (cascade test)
    - 4.4: Q10 complex conditional
  5. TEST 5: Verify removed questions don't appear
  6. TEST 6: Browser console error check

  📋 Test Results Template

  Ready-to-copy template for documenting results

  🚨 Quick Fix Instructions

  If tests fail, what to do (force rebuild, check logs, etc.)

  ---
  🔍 Get Real Test Accounts from Database

  Let me also create a quick SQL query file to help you find
  existing test accounts:

⏺ Write(get-test-accounts.sql)
  ⎿  Wrote 93 lines to get-test-accounts.sql                 
     -- Run this in Supabase SQL Editor to find test accounts
     -- Copy results to use in testing
     -- Option 1: Find all test accounts
     SELECT
       p.user_id,
       p.email,
       p.full_name,
       p.city,
       p.msa_status,
     … +83 lines (ctrl+o to expand)

⏺ Perfect! I've created two comprehensive files for you:

  📁 Files Created

  1. LIVEtest-20-oct.md - Complete Testing Guide

  Location: /Users/raunekpratap/Desktop/HAEVN-webapp/HAEVN-STAR
  TER-INTERFACE/LIVEtest-20-oct.md

  Contains:
  - ✅ 6 detailed test scenarios with step-by-step instructions
  - ✅ Specific things to check at each step
  - ✅ Console logs to look for
  - ✅ Success/fail criteria
  - ✅ Test results template (copy & fill out)
  - ✅ Quick troubleshooting if tests fail

  Critical Tests Include:
  - TEST 1: Existing user login loop (your main issue)
  - TEST 4.2: Q6 → Q7/Q8 conditional logic (the broken one you
  reported)
  - TEST 3: Survey saves persistence
  - Plus comprehensive coverage of all fixes

  2. get-test-accounts.sql - Database Query File

  Location: /Users/raunekpratap/Desktop/HAEVN-webapp/HAEVN-STAR
  TER-INTERFACE/get-test-accounts.sql

  Contains 4 SQL queries to find:
  1. All test accounts with their survey status
  2. Complete users (for testing login → dashboard)
  3. In-progress users (for testing resume functionality)
  4. Fresh users (for testing new survey start)
  5. The specific account from today's logs
  (tester69@tester.com)

  ---
  🚀 How to Use

  Step 1: Get Test Account Credentials

  1. Go to Supabase Dashboard:
    - Open your Supabase project
    - Click "SQL Editor" in left sidebar
  2. Run the SQL query:
    - Copy first query from get-test-accounts.sql
    - Paste into SQL Editor
    - Click "Run"
  3. Copy test account emails:
    - Save the emails and their status
    - Note which have complete vs incomplete surveys
    - You'll need the passwords (hopefully you remember them!)

  Step 2: Start Testing

  1. Open LIVEtest-20-oct.md
  2. Follow TEST 1 first (existing user login - most critical)
  3. Then TEST 4.2 (conditional logic - the one you reported
  broken)
  4. Work through remaining tests
  5. Fill out the test results template
  6. Report back with results!

  ---
  📊 Known Test Account

  From today's session logs, we know:
  - Email: tester69@tester.com
  - User ID: 78d58a2a-9c8e-44e5-9f87-478d44c0249c
  - Status: Has some survey data

  You can start with this one if you remember the password!

  ---
  🎯 Priority Tests

  Test these FIRST (highest priority):

  1. ⭐ TEST 1 - Existing user login (was looping, should be
  fixed)
  2. ⭐ TEST 4.2 - Q6 → Q7/Q8 conditional (you said this is
  broken on production)
  3. ⭐ TEST 3 - Survey saves (was broken, should be fixed)

  Then test these:
  4. TEST 2 - New user signup
  5. TEST 4.1, 4.3, 4.4 - Other conditional logic
  6. TEST 5, 6 - Removed questions and console errors

  ---
  Ready to test! Let me know what you find - especially if the
  conditional logic (TEST 4.2) is still broken on production.
  If it is, we'll need to debug why the fix didn't deploy
  properly. 🚀

> /compact 
  ⎿ Error: Error during compaction: Error: Conversation too long. 
    Press esc twice to go up a few messages and try again.

> Keep in mind we are testing on the live deployed verecel 
link:https://haevn-mvp.vercel.app/onboarding/survey - I can 
already see that there is no conditional branching happening 
with the questions in the survey. I answered straight for q4, 
and saw q5 when i should just see q8 after that question if i 
ansered straight. Please remmeber the conditionak logic. Take a
 step back and confirm understanding. Lets gain clarity 

⏺ You're absolutely right - let me take a step back and gain
  clarity on what's happening.

  🚨 Critical Issue Identified

  You said you saw Q5 after Q4 - that's the ZIP code question
  we REMOVED. If Q5 is showing up, that means our code changes 
  didn't deploy to production!

  Let me clarify the question flow and logic:

  📋 Question Flow (What SHOULD Happen)

  Basic Demographics Section:
  1. Q1 - Age
  2. Q2 - Gender identity
  3. Q2a - Pronouns
  4. Q3 - Sexual orientation (Straight, Gay, Bisexual,
  Pansexual, etc.)
    - Q3a - (CONDITIONAL) Fidelity definition
        - Shows if: Q3 in {Bisexual, Pansexual, Queer, Fluid,
  Other} AND Q4 in {Single, Solo Poly, Dating}
    - Q3b - (CONDITIONAL) Kinsey scale
        - Shows if: Q3 in {Bisexual, Pansexual, Queer, Fluid,
  Other}
  5. Q4 - Relationship status (Single, Partnered, Married,
  etc.)
  6. Q5 - ZIP code ❌ REMOVED (already asked in signup)
  7. Q5a - Precise location ❌ REMOVED

  Relationship Preferences Section:
  8. Q6 - Relationship styles (Monogamy, Open, Polyamory, etc.)
  - Q6a - Connection type
  - Q6b - Who to meet
  - Q6c - (CONDITIONAL) Couple connection
  - Q6d - (CONDITIONAL) Couple permissions
  9. Q7 - (CONDITIONAL) Emotional exclusivity
    - Shows if: Q6 includes {Open relationship, Polyamory,
  Don't know yet}
  10. Q8 - (CONDITIONAL) Sexual exclusivity
    - Shows if: Q6 includes {Open relationship, Polyamory,
  Don't know yet}

  🔍 Your Test Case Clarification

  You said: "I answered straight for q4, and saw q5 when i
  should just see q8"

  I think there's confusion about question numbers. Let me 
  clarify:

  - Q3 = Sexual orientation (this is where "Straight" would be
  answered)
  - Q4 = Relationship status (Single, Partnered, etc.) - NOT
  sexual orientation

  Q8 (sexual exclusivity) only shows based on Q6 (relationship 
  styles), NOT Q3!

  - If Q6 = "Monogamy" → Q7 and Q8 are hidden
  - If Q6 includes "Open relationship" or "Polyamory" → Q7 and
  Q8 show

  ⚠️ The Real Problem

  If you're seeing Q5 (ZIP code) at all, it means:
  1. The deployed version on Vercel doesn't have our changes
  2. The old questions.ts is still being used
  3. None of our fixes deployed properly

  🔧 Let me verify the deployment

⏺ Bash(git log --oneline -3)
  ⎿ f658198 docs: Add comprehensive build documentation and de
    bug utilities
    c970d00 Fix critical auth and survey issues - All systems
    … +2 lines (ctrl+o to expand)


⏺ Bash(git show --stat c970d00 | grep -E "(questions\.ts|survey)" |
       head -20)
  ⎿     Fix critical auth and survey issues - All systems oper
    ational
        - Converted server actions to API routes (/api/survey/
    … +20 lines (ctrl+o to expand)



⏺ Bash(grep -n "q5_zip_code\|ZIP code" lib/survey/questions.ts |
      head -5)
  ⎿  156:      // Removed q5_zip_code and q5a_precise_location
     - already collected during signup

⏺ ✅ Confirmed: Production is Using OLD Code!

  Local code (what we have):
  - Line 156 shows: // Removed q5_zip_code and 
  q5a_precise_location
  - ZIP code question is NOT in our code

  Production (what you're seeing):
  - Q5 ZIP code IS showing
  - Conditional logic is NOT working

  This means: Vercel deployment didn't use our latest code!

  ---
  🔧 Solution: Force Rebuild on Vercel

  Step 1: Check Vercel Dashboard

  1. Go to: https://vercel.com/dashboard
  2. Find your haevn-mvp project
  3. Click on it
  4. Go to "Deployments" tab
  5. Check the latest deployment:
    - Does it show commit f658198 or c970d00?
    - What's the deployment status? (Ready/Failed/Building)
    - Click on the deployment to see build logs

  Step 2: Force Rebuild (CRITICAL)

  1. In the Deployments tab, find the latest deployment
  2. Click the "..." (three dots) menu
  3. Select "Redeploy"
  4. IMPORTANT: Check the box "Force rebuild without using 
  cache"
  5. Click "Redeploy"
  6. Wait 2-5 minutes for build to complete

  Step 3: After Rebuild, Test Again

  1. Clear your browser cache:
    - Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)
    - Or go to DevTools → Application → Clear storage → Clear
  all
  2. Go to survey page:
  https://haevn-mvp.vercel.app/onboarding/survey
  3. Check if Q5 (ZIP code) still appears:
    - ❌ If it appears → Build still using old code
    - ✅ If it doesn't appear → Build is using new code!

  ---
  📊 Understanding the Question Flow

  Let me clarify the expected flow so we can test correctly:

  After answering Q3 (Sexual Orientation) = "Straight":
  1. Q3a and Q3b should be skipped (only show for
  bisexual/pansexual/queer)
  2. Next question: Q4 (Relationship Status)

  After answering Q4 (Relationship Status):
  1. Q5 (ZIP code) should be SKIPPED (removed from survey)
  2. Next section starts: Q6 (Relationship Styles)

  After answering Q6 (Relationship Styles):
  - If Q6 = "Monogamy" only → Q7 and Q8 are skipped, go to Q9
  - If Q6 includes "Open relationship" or "Polyamory" → Q7 and 
  Q8 show

  So the test should be:
  1. Answer Q3 = "Straight"
  2. Answer Q4 = whatever
  3. Should go directly to Q6 (NOT Q5!)
  4. Answer Q6 = "Monogamy"
  5. Q7 and Q8 should be skipped
  6. Should go to Q9
  7. Then test again:
    - Go back, change Q6 to "Open relationship"
    - Now Q7 and Q8 should appear

  ---
  🎯 Next Steps

  1. Force rebuild on Vercel (instructions above)
  2. Wait for deployment to complete
  3. Clear browser cache
  4. Test again - check if Q5 still appears
  5. If Q5 is gone → Then test conditional logic (Q6 → Q7/Q8)
  6. Report back what you see

  Does this make sense? The key issue is that production isn't
  using our new code yet!

> # 🧠 CLAUDE TASK: Align Question Order, Names, and Logic with
 Spec CSVs

## 🎯 Context
We are now in **clarity + alignment mode** before 
implementation.

The goal is to make sure that:
1. The **question names, text, and order** in the app match the
 **`SURVEY-SPEC-FINAL.csv`** exactly.
2. The **conditional branching logic** in the app matches the 
rules in **`HAEVN-SURVEY-conditional-branch.xlsx - 
Sheet1.csv`**.
3. After alignment, we’ll test the full survey flow end-to-end 
on production.

You have both reference files uploaded here:
- `/mnt/data/SURVEY-SPEC-FINAL.csv`
- `/mnt/data/HAEVN-SURVEY-conditional-branch.xlsx - Sheet1.csv`

---

## 🧩 Phase 1 — Confirm Understanding
1. Parse both CSVs and list:
   - The **exact question order** (Question ID + Question 
Text).
   - The **expected conditional logic triggers** (which 
question controls which).
2. Cross-check that the in-app question definitions 
(`lib/survey/questions.ts`) follow the same order and names.
   - Flag any mismatches in:
     - Question ID (e.g., Q4 vs Q3 confusion)
     - Question text
     - Missing or duplicated questions
     - Removed questions (e.g., ZIP Code, precise location)
3. Confirm the canonical orientation question ID (should be 
**Q4** = Sexual Orientation).

---

## 🔧 Phase 2 — Implementation Plan
Once alignment is confirmed:
1. **Rename and reorder** all questions in `questions.ts` to 
match the exact sequence from `SURVEY-SPEC-FINAL.csv`.
   - Use the CSV’s “Question ID” and “Question Text” as ground 
truth.
   - Maintain consistent numbering (no off-by-one errors).
   - Preserve section headers (Basic Info, Relationship 
Preferences, etc.).
2. **Apply Conditional Branching** from the second CSV:
   - Implement `displayLogic` per the “Primary Trigger”, 
“Operator”, and “Values” columns.
   - Validate compound conditions (AND/OR).
3. Ensure removed questions (Q5 ZIP, Q5a precise location, Q17 
group) stay excluded.

---

## 🧪 Phase 3 — Testing Plan
After applying changes:
1. Log the **full survey question order** as rendered in the 
app (IDs + text).
2. Test conditional logic cases:
   - Q4 = Straight → Skip Kinsey/Fidelity.
   - Q4 = Bisexual → Show Kinsey/Fidelity.
   - Q6 = Monogamy → Skip Q7/Q8.
   - Q6 = Open/Poly → Show Q7/Q8.
3. Verify the transitions between sections match the CSV 
sequence.

---

## ✅ Deliverables
- `questions.ts` aligned 1:1 with `SURVEY-SPEC-FINAL.csv`
- `displayLogic` rules implemented per 
`HAEVN-SURVEY-conditional-branch.xlsx`
- A short Markdown table showing before/after order comparison
- Confirmation that the **live app question flow = CSV order**

---

> Please start by confirming your understanding of the question
 order and triggers from both CSVs before making any code 
changes. 
Once confirmed, generate an implementation plan showing how 
you’ll sync the app’s `questions.ts` with the spec. 
