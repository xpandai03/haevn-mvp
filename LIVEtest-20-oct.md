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

---
---

# 📋 CSV SPECIFICATION ANALYSIS (October 21, 2025)

## 🎯 Task Objective
Parse both CSV specification files and compare with current implementation in `lib/survey/questions.ts` to identify mismatches in question order, naming, options, and conditional logic.

---

## 📊 Canonical Question Order (from SURVEY-SPEC-FINAL.csv)

| CSV ID | Question Text | Answer Type | Required | Notes |
|--------|---------------|-------------|----------|-------|
| **Q1** | What is your age? | numeric (18-99) | ✅ Yes | Eligibility check |
| **Q2** | What is your gender identity? | single+other | ✅ Yes | 8 options: Man, Woman, Non-binary, Trans man, Trans woman, Genderqueer/Genderfluid, Prefer not to say, Self-describe |
| **Q2a** | What pronouns do you use? | single+other | ✅ Yes | She/her, He/him, They/them, She/they, He/they, Prefer not to say, Self-describe |
| **Q3** | Sexual orientation | **single** | ✅ Yes | **NOTE: SINGLE SELECT, NOT MULTISELECT!** Options: Straight, Gay/Lesbian, Bisexual, Pansexual, Queer, Fluid, Asexual, Demisexual, Questioning/Unsure, Prefer not to say, Other |
| **Q3a** | How do you experience fidelity? | single | 📋 Conditional | **Show if Q3 in {Bisexual,Pansexual,Queer,Fluid,Other} AND Q4 in {Single,Solo Poly,Dating}** |
| **Q3b** | Where do you see yourself on the Kinsey Scale? | single | ❌ No | 8 options: K0-K6 + Prefer not to say |
| **Q3c** | Kinsey preference for partners | multi | ❌ No | K0-K6 + No preference |
| **Q4** | Relationship status | single | ✅ Yes | Options: Single, Dating, Married, Partnered, Couple, In a polycule, Solo Poly, Exploring, Prefer not to say |
| **Q5** | Primary city or ZIP | text | ✅ Yes | **REQUIRED IN CSV!** Used for location gating |
| **Q5a** | Allow precise location? | single | ✅ Yes | **REQUIRED IN CSV!** Yes/No |
| **Q6** | Relationship orientation preference | single | ✅ Yes | Options: **Monogamous, Monogamish, ENM, Polyamorous, Open, Exploring** |
| **Q6a** | How do you imagine connecting? | multi | ✅ Yes | As an individual, As a couple, As part of a polycule/pod, Open to any |
| **Q6b** | Who do you want to connect with? | multi | ✅ Yes | **HARD FILTER** - Women, Men, Non-binary people, All genders, Other, Prefer not to say |
| **Q6c** | If connecting as a couple, how? | single | 📋 Conditional | **Show if Q4 INCLUDES {Dating, Married, Partnered, Couple}** (NOT Q6a!) |
| **Q6d** | Couple permissions | matrix | 📋 Conditional | **Show if Q6c = 'custom'** |
| **Q7** | Importance of emotional exclusivity | likert_1_5 | ✅ Yes | 1=Not important, 5=Extremely |
| **Q8** | Importance of sexual exclusivity | likert_1_5 | ✅ Yes | 1=Not important, 5=Extremely |
| **Q9** | Relational intentions (select all) | multi+other | ✅ Yes | Long-term partner, Short-term partner, Play partner, FWB, Community/social, Group/polycle, Other |
| **Q9a** | Sex only or more? | single | ✅ Yes | 5 options from "Sex/erotic only" to "Primarily relational" |
| **Q10** | Attachment style | single | ✅ Yes | Secure, Anxious, Avoidant, Unsure |
| **Q10a** | Emotional availability | single | ✅ Yes | Fully available, Somewhat open, Mostly unavailable, Exploring |
| **Q11** | Love languages (select all) | multi | ✅ Yes | Words, Quality time, Physical touch, Acts of service, Gifts, Other |
| **Q12** | Conflict resolution | single+other | ✅ Yes | Talk immediately, Take space then reconnect, Avoid conflict, Other |
| **Q12a** | Messaging pace | likert_1_5 | ✅ Yes | 1=Very slow, 5=Very fast |
| ... | *(continues through Q38a)* | | | |
| **Q17** | Children | single | ❌ No | **DELETE/HIDE - NOT MVP** |
| **Q17a** | Dietary preferences/allergies | multi+other | ❌ No | **DELETE/HIDE - NOT MVP** |
| **Q17b** | Pets at home / preferences | multi+other | ❌ No | **DELETE/HIDE - NOT MVP** |
| **Q33** | Kinks/fetishes of interest | multi+other | ❌ No | Optional depth |
| **Q33a** | Experience level for selected kinks | single | 📋 Conditional | **Show if Q33 answered** |

---

## 🔍 Conditional Logic Rules (from HAEVN-SURVEY-conditional-branch.xlsx)

| Question | Trigger Rule | Action |
|----------|--------------|--------|
| **Q6c** | `Q4 INCLUDES {Dating, Married, Partnered, Couple}` | Show |
| **Q6d** | `Q6c = 'custom'` | Show |
| **Q7** | `Q6 INCLUDES {Monogamish, Open, Polyamorous, Don't know yet}` | Show |
| **Q8** | `Q6 INCLUDES {Monogamish, Open, Polyamorous, Don't know yet}` | Show |
| **Q10** | `(Q4 = Single AND Q6 = {Monogamous, Monogamish, Polyamorous})` **OR** `(Q4 = {Dating, Married, Partnered, Couple} AND Q6 = Polyamorous)` | Show |
| **Q12** | `Q4 = Single AND Q6 INCLUDES {Monogamous, Monogamish, Polyamorous}` | Show |
| **Q17, Q17a, Q17b** | N/A | **DELETE - NOT MVP** |

---

## 🚨 CRITICAL DISCREPANCIES FOUND

### 1. **Q3 (Sexual Orientation) - Type Mismatch**
- **CSV Spec:** `single` (single select)
- **Current Code:** `multiselect`
- **Impact:** Users can select multiple orientations when spec says single choice only
- **Fix Required:** Change type from `multiselect` to `select`

### 2. **Q4 (Relationship Status) - Options Mismatch**
- **CSV Spec:** Single, Dating, Married, Partnered, **Couple**, In a polycule, Solo Poly, **Exploring**, Prefer not to say
- **Current Code:** Single, Partnered, Married, In a polycule, Solo Poly, **It's complicated**, Other
- **Missing:** "Dating", "Couple", "Exploring", "Prefer not to say"
- **Extra:** "It's complicated", "Other"
- **Impact:** Conditional logic referencing "Dating" or "Couple" won't work
- **Fix Required:** Update options to match CSV exactly

### 3. **Q5 & Q5a (ZIP Code & Location) - Incorrectly Removed**
- **CSV Spec:** Q5 and Q5a are **REQUIRED** questions in the survey
- **Current Code:** Removed with comment "already collected during signup"
- **Conflict:** CSV shows these as core survey questions, not signup questions
- **Impact:** Question numbering is off, Q6 becomes Q5 internally
- **Fix Required:** Decision needed - Keep in survey per CSV, or update CSV spec?

### 4. **Q6 (Relationship Orientation) - Options Completely Different**
- **CSV Spec:** **Monogamous**, **Monogamish**, **ENM**, **Polyamorous**, **Open**, **Exploring**
- **Current Code:** **Monogamy**, **Open relationship**, **Polyamory**, Relationship anarchy, Swinging, **Don't know yet**, Other
- **Mismatch:** Different wording and missing key option "Monogamish" and "ENM"
- **Impact:** Conditional logic breaks because it references "Monogamish" which doesn't exist
- **Fix Required:** Update options to match CSV exactly

### 5. **Q6c (Couple Connection) - WRONG CONDITIONAL TRIGGER** 🚨
- **CSV Spec:** `Show if Q4 INCLUDES {Dating, Married, Partnered, Couple}`
- **Current Code:** `Show if Q6a includes 'couple'`
- **Impact:** Question shows based on WRONG trigger - totally broken logic!
- **Fix Required:** Change displayLogic to check Q4 relationship status, not Q6a connection type

### 6. **Q7 & Q8 (Exclusivity) - Conditional Logic Needs Update**
- **CSV Spec:** `Show if Q6 INCLUDES {Monogamish, Open, Polyamorous, Don't know yet}`
- **Current Code:** `Show if Q6 includes 'Open relationship' OR Q6 includes 'Polyamory' OR Q6 includes 'Don't know yet'`
- **Impact:** Missing "Monogamish" option, option names don't match
- **Fix Required:** Update to match CSV option names exactly

### 7. **Q10 (Attachment Style) - Conditional Logic Incomplete**
- **CSV Spec:**
  - Show if `(Q4 = Single AND Q6 = {Monogamous, Monogamish, Polyamorous})`
  - **OR** `(Q4 = {Dating, Married, Partnered, Couple} AND Q6 = Polyamorous)`
- **Current Code:**
  - `(Q4='Single' AND (Q6 includes 'Monogamy' OR Q6 includes 'Polyamory'))`
  - **OR** `((Q4='Partnered' OR Q4='Married') AND Q6 includes 'Polyamory')`
- **Missing:** "Dating" and "Couple" in second condition, "Monogamish" in both
- **Impact:** Question won't show for users in "Dating" or "Couple" status
- **Fix Required:** Add missing Q4 status options and "Monogamish"

### 8. **Q12 (Conflict Resolution) - Conditional Logic Needs Update**
- **CSV Spec:** `Q4 = Single AND Q6 INCLUDES {Monogamous, Monogamish, Polyamorous}`
- **Current Code:** `Q4='Single' AND (Q6 includes 'Monogamy' OR Q6 includes 'Polyamory')`
- **Missing:** "Monogamish" option
- **Impact:** Won't show for monogamish users
- **Fix Required:** Add "Monogamish" to condition

### 9. **Q17, Q17a, Q17b - Correctly Hidden** ✅
- **CSV Spec:** "Delete or Hide (For Now - NOT MVP)"
- **Current Code:** Commented out
- **Status:** **CORRECT** - These are properly hidden

---

## 📑 Side-by-Side Comparison: CSV vs Current Code

### Question Order Comparison

| CSV Order | CSV ID | Current Code Order | Current ID | Match? |
|-----------|--------|-------------------|------------|--------|
| 1 | Q1 (Age) | 1 | q1_age | ✅ Match |
| 2 | Q2 (Gender) | 2 | q2_gender_identity | ✅ Match |
| 3 | Q2a (Pronouns) | 3 | q2a_pronouns | ✅ Match |
| 4 | **Q3 (Orientation)** | 4 | q3_sexual_orientation | ⚠️ **Type Mismatch** |
| 5 | Q3a (Fidelity) | 5 | q3a_fidelity | ✅ Match |
| 6 | Q3b (Kinsey) | 6 | q3b_kinsey_scale | ✅ Match |
| 7 | Q3c (Kinsey Pref) | 7 | q3c_partner_kinsey_preference | ✅ Match |
| 8 | **Q4 (Rel Status)** | 8 | q4_relationship_status | ⚠️ **Options Mismatch** |
| 9 | **Q5 (ZIP)** | ❌ **REMOVED** | ~~q5_zip_code~~ | ❌ **MISSING** |
| 10 | **Q5a (Location)** | ❌ **REMOVED** | ~~q5a_precise_location~~ | ❌ **MISSING** |
| 11 | **Q6 (Rel Orient)** | 9 | q6_relationship_styles | ⚠️ **Options Mismatch** |
| 12 | Q6a (Connection) | 10 | q6a_connection_type | ✅ Match |
| 13 | Q6b (Who) | 11 | q6b_who_to_meet | ✅ Match |
| 14 | **Q6c (Couple)** | 12 | q6c_couple_connection | ❌ **Logic Wrong** |
| 15 | Q6d (Permissions) | 13 | q6d_couple_permissions | ✅ Match |
| 16 | **Q7 (Emotional)** | 14 | q7_emotional_exclusivity | ⚠️ **Logic Needs Update** |
| 17 | **Q8 (Sexual)** | 15 | q8_sexual_exclusivity | ⚠️ **Logic Needs Update** |
| 18 | Q9 (Intentions) | 16 | q9_intentions | ✅ Match |
| 19 | Q9a (Sex/More) | 17 | q9a_sex_or_more | ✅ Match |
| 20 | **Q10 (Attachment)** | 18 | q10_attachment_style | ⚠️ **Logic Incomplete** |
| ... | ... | ... | ... | ... |

**Summary:**
- ✅ **Correct:** 15 questions match order and logic
- ⚠️ **Needs Update:** 7 questions have mismatches
- ❌ **Missing:** 2 questions (Q5, Q5a) removed from code but required in CSV
- ❌ **Critical:** 1 question (Q6c) has completely wrong conditional logic

---

## 🔧 IMPLEMENTATION PLAN

### Phase 1: Critical Fixes (Blocking Issues)

#### 1.1 Fix Q6 Options (Enables All Conditional Logic)
**File:** `lib/survey/questions.ts:165-180`

**Current:**
```typescript
options: [
  'Monogamy',
  'Open relationship',
  'Polyamory',
  'Relationship anarchy',
  'Swinging',
  'Don\'t know yet',
  'Other'
]
```

**Change to:**
```typescript
options: [
  'Monogamous',
  'Monogamish',
  'ENM',
  'Polyamorous',
  'Open',
  'Exploring'
]
```

#### 1.2 Fix Q4 Options (Enables Q6c and Q10 Logic)
**File:** `lib/survey/questions.ts:140-155`

**Current:**
```typescript
options: [
  'Single',
  'Partnered',
  'Married',
  'In a polycule',
  'Solo Poly',
  'It\'s complicated',
  'Other'
]
```

**Change to:**
```typescript
options: [
  'Single',
  'Dating',
  'Married',
  'Partnered',
  'Couple',
  'In a polycule',
  'Solo Poly',
  'Exploring',
  'Prefer not to say'
]
```

#### 1.3 Fix Q3 Type (Single Select Instead of Multi)
**File:** `lib/survey/questions.ts:82-100`

**Current:**
```typescript
{
  id: 'q3_sexual_orientation',
  csvId: 'Q3',
  label: 'How do you describe your sexual orientation?',
  type: 'multiselect',
  ...
}
```

**Change to:**
```typescript
{
  id: 'q3_sexual_orientation',
  csvId: 'Q3',
  label: 'Sexual orientation',
  type: 'select',  // Changed from multiselect
  options: [
    'Straight',
    'Gay/Lesbian',
    'Bisexual',
    'Pansexual',
    'Queer',
    'Fluid',
    'Asexual',
    'Demisexual',
    'Questioning/Unsure',
    'Prefer not to say',
    'Other'
  ],
  ...
}
```

#### 1.4 Fix Q6c Conditional Logic (CRITICAL!)
**File:** `lib/survey/questions.ts:210-223`

**Current:**
```typescript
displayLogic: "Show if Q6a includes 'couple'"
```

**Change to:**
```typescript
displayLogic: "Q4 in {Dating,Married,Partnered,Couple}"
```

#### 1.5 Update Q7 & Q8 Conditional Logic
**File:** `lib/survey/questions.ts:234-257`

**Current:**
```typescript
displayLogic: "Show if Q6 includes 'Open relationship' OR Q6 includes 'Polyamory' OR Q6 includes 'Don\\'t know yet'"
```

**Change to:**
```typescript
displayLogic: "Q6 in {Monogamish,Open,Polyamorous,Exploring}"
```

#### 1.6 Update Q10 Conditional Logic
**File:** `lib/survey/questions.ts:297-311`

**Current:**
```typescript
displayLogic: "(Q4='Single' AND (Q6 includes 'Monogamy' OR Q6 includes 'Polyamory')) OR ((Q4='Partnered' OR Q4='Married') AND Q6 includes 'Polyamory')"
```

**Change to:**
```typescript
displayLogic: "(Q4='Single' AND Q6 in {Monogamous,Monogamish,Polyamorous}) OR (Q4 in {Dating,Married,Partnered,Couple} AND Q6='Polyamorous')"
```

#### 1.7 Update Q12 Conditional Logic
**File:** `lib/survey/questions.ts:337-351`

**Current:**
```typescript
displayLogic: "Q4='Single' AND (Q6 includes 'Monogamy' OR Q6 includes 'Polyamory')"
```

**Change to:**
```typescript
displayLogic: "Q4='Single' AND Q6 in {Monogamous,Monogamish,Polyamorous}"
```

### Phase 2: Q5/Q5a Decision (Needs User Input)

**Question for User:**

The CSV spec shows Q5 (ZIP code) and Q5a (precise location) as **required survey questions**, but the current implementation removed them with the comment "already collected during signup."

**Options:**

**Option A: Keep Removed (Current Approach)**
- Pros: Avoids asking users twice
- Cons: Breaks CSV spec, question numbering is off
- Action: Update CSV spec to remove Q5/Q5a

**Option B: Re-add to Survey**
- Pros: Matches CSV spec exactly
- Cons: Asks users for ZIP twice (signup + survey)
- Action: Restore Q5/Q5a questions in code

**Option C: Conditional Display**
- Pros: Only asks if not provided during signup
- Cons: More complex logic
- Action: Add displayLogic: "Show if ZIP not collected in signup"

**Recommendation:** Option A - Keep removed, update CSV spec to reflect that ZIP is collected during signup.

### Phase 3: Additional Updates

#### 3.1 Update Q3a Conditional Logic
**Current:** Already correct ✅
```typescript
displayLogic: "Show if Q3 in {Bisexual,Pansexual,Queer,Fluid,Other} AND Q4 in {Single,Solo Poly,Dating}"
```

**Note:** Will need to update after Q4 options are fixed to use exact CSV option names.

#### 3.2 Review All Question Labels
Several questions have different labels in CSV vs code:
- Q3: "Sexual orientation" (CSV) vs "How do you describe your sexual orientation?" (Code)
- Q6: "Relationship orientation preference" (CSV) vs "What relationship style(s) interest you?" (Code)

**Decision Needed:** Keep friendly wording in code, or match CSV exactly?

---

## 📋 Implementation Checklist

- [ ] **Phase 1: Critical Fixes**
  - [ ] 1.1 Update Q6 options to match CSV (Monogamous, Monogamish, ENM, Polyamorous, Open, Exploring)
  - [ ] 1.2 Update Q4 options to match CSV (add Dating, Couple, Exploring, Prefer not to say)
  - [ ] 1.3 Change Q3 from multiselect to select
  - [ ] 1.4 Fix Q6c conditional logic (change from Q6a to Q4 trigger)
  - [ ] 1.5 Update Q7/Q8 conditional logic for new Q6 options
  - [ ] 1.6 Update Q10 conditional logic for new Q4 and Q6 options
  - [ ] 1.7 Update Q12 conditional logic for new Q6 options

- [ ] **Phase 2: Q5/Q5a Decision**
  - [ ] Decide: Remove from CSV or re-add to survey?
  - [ ] If re-adding: Restore Q5 and Q5a questions
  - [ ] If keeping removed: Document in CSV spec

- [ ] **Phase 3: Additional Updates**
  - [ ] Update Q3a logic for new Q4 option names
  - [ ] Review and update question labels if needed
  - [ ] Update Q3 options to match CSV exactly
  - [ ] Test all conditional logic with new options

- [ ] **Testing**
  - [ ] Test Q6c shows for Dating/Married/Partnered/Couple status
  - [ ] Test Q7/Q8 show for Monogamish/Open/Polyamorous/Exploring
  - [ ] Test Q10 shows for all specified combinations
  - [ ] Test Q12 shows for Single + (Monogamous/Monogamish/Polyamorous)
  - [ ] Test Q3a shows for non-monosexual + specific relationship statuses
  - [ ] Verify all questions use correct option names in logic

- [ ] **Deployment**
  - [ ] Commit changes with detailed message
  - [ ] Push to trigger Vercel deployment
  - [ ] Force rebuild on Vercel (no cache)
  - [ ] Test on production

---

## 🎯 Summary for User Review

### What We Found:
1. **7 questions have mismatches** between CSV spec and current code
2. **Q6c has completely wrong conditional logic** (checks Q6a instead of Q4)
3. **Q6 and Q4 option names don't match CSV**, breaking all conditional logic
4. **Q3 is multiselect in code but single-select in CSV**
5. **Q5/Q5a are in CSV but removed from code** (conflict needs resolution)

### What Needs to Change:
1. **Update Q4 and Q6 options** to match CSV exactly
2. **Fix all conditional logic** to reference correct option names
3. **Change Q3 to single-select**
4. **Fix Q6c trigger** from Q6a to Q4
5. **Decide on Q5/Q5a** - remove from CSV or add back to survey?

### Impact:
Once these changes are made:
- ✅ All conditional logic will work correctly
- ✅ Questions will show/hide based on CSV spec rules
- ✅ Survey will match the canonical specification exactly
- ✅ No more confusion about question numbering

### Next Steps:
1. **Review this analysis**
2. **Decide on Q5/Q5a approach** (keep removed vs re-add)
3. **Approve implementation plan**
4. **Execute Phase 1 critical fixes**
5. **Test thoroughly**
6. **Deploy to production**

---

**Analysis completed:** October 21, 2025
**CSV files analyzed:**
- `SURVEY-SPEC-FINAL.csv` (455 lines, 38 questions)
- `HAEVN-SURVEY-conditional-branch.xlsx - Sheet1.csv` (11 lines, 6 conditional rules)
