# Phase 2: Kill-Switch & Isolation Testing Guide

**Purpose:** Test that removing client-side `getResumeStep()` calls eliminates the 400 errors, proving our root cause analysis is correct.

---

## Test Setup

### 1. Enable Kill-Switch

Edit `.env.local`:

```bash
# Disable client-side getResumeStep() calls
NEXT_PUBLIC_DISABLE_CLIENT_RESUME_STEP=true
```

**What this does:**
- Login page will skip `flowController.getResumeStep()` and go directly to `/dashboard`
- Signup page will skip `flowController.getResumeStep()` and go directly to `/dashboard`
- **Expected result:** No 400 errors in Network tab

### 2. Enable Test User Short-Circuit (Optional)

Edit `.env.local`:

```bash
# Set your test email
TEST_USER_EMAIL=raunek@cloudsteer.com
```

**What this does:**
- Middleware will immediately redirect test user from onboarding routes to `/dashboard`
- Bypasses all completion checks
- **Use case:** Quickly test dashboard without completing onboarding

### 3. Restart Dev Server

```bash
# Kill existing dev server
# Then restart:
npm run dev
```

**Important:** Environment variables are only loaded at server start!

---

## Test Scenarios

### Scenario A: Kill-Switch Enabled

**Steps:**
1. Set `NEXT_PUBLIC_DISABLE_CLIENT_RESUME_STEP=true` in `.env.local`
2. Restart dev server
3. Open browser in Incognito mode
4. Go to http://localhost:3000/auth/login
5. Log in with existing user
6. Open Network tab in DevTools

**Expected Behavior:**
- Console shows: `[Login] 🔴 KILL-SWITCH ACTIVE: Skipping client-side getResumeStep()`
- Console shows: `[Login] Redirecting to /dashboard (default)`
- **NO** `GET /rest/v1/user_survey_responses` requests in Network tab
- Page redirects to `/dashboard` successfully

**If you see 400 errors:** The issue is elsewhere (not the client-side call)

**If NO 400 errors:** This confirms client-side `getResumeStep()` is the problem ✅

### Scenario B: Test User Short-Circuit

**Steps:**
1. Set `TEST_USER_EMAIL=your@email.com` in `.env.local`
2. Restart dev server
3. Log in with that email
4. Try to access any `/onboarding/*` route

**Expected Behavior:**
- Middleware logs: `[TRACE-MW] 🔴 TEST USER SHORT-CIRCUIT ACTIVE`
- Immediately redirected to `/dashboard`
- Bypasses all onboarding completion checks

**Use case:** Test dashboard features without completing full onboarding flow

### Scenario C: Kill-Switch Disabled (Current State)

**Steps:**
1. Set `NEXT_PUBLIC_DISABLE_CLIENT_RESUME_STEP=false` (or comment out)
2. Restart dev server
3. Log in with existing user

**Expected Behavior:**
- Normal flow: calls `flowController.getResumeStep()`
- **WILL see 400 error** in Network tab
- This is the current broken state we're fixing in Phase 3

---

## Expected Console Output

### With Kill-Switch ON:

```
[Login] 🔴 KILL-SWITCH ACTIVE: Skipping client-side getResumeStep()
[Login] Redirecting to /dashboard (default)
```

### With Kill-Switch OFF (current broken state):

```
[Login] ===== GETTING RESUME PATH =====
[Login] User ID for flow controller: xxx
[FLOW] ===== GET RESUME STEP =====
[FLOW] Partnership membership: {...}
[FLOW] ✅ Guard active before user_survey_responses query: xxx
[FLOW] ❌ Error fetching survey: <error message>
[FLOW] Code: PGRST116 (or similar)
```

---

## Network Tab Analysis

### ✅ SUCCESS (Kill-switch ON):

**What you should see:**
- `/rest/v1/partnerships` - 200 OK (normal)
- `/api/survey/load` - 200 OK (normal)
- **NO `/rest/v1/user_survey_responses`** (this is the forbidden call)

### ❌ FAILURE (Kill-switch OFF):

**What you'll see:**
- `/rest/v1/partnership_members` - 200 OK
- **`/rest/v1/user_survey_responses` - 400 Bad Request** ← THE PROBLEM
- Request triggered from client-side JavaScript
- Fails due to RLS policy or invalid query

---

## Verification Checklist

Before moving to Phase 3, confirm:

- [ ] **Test 1:** Kill-switch ON → No 400 errors
- [ ] **Test 2:** Kill-switch OFF → 400 errors appear
- [ ] **Test 3:** Console logs show kill-switch messages
- [ ] **Test 4:** Middleware short-circuit works (if enabled)
- [ ] **Test 5:** Screenshots captured for documentation

---

## Why This Proves the Root Cause

**Logic:**
1. If kill-switch ON → No 400 errors → **Client call is the problem**
2. If kill-switch OFF → 400 errors return → **Client call causes errors**
3. Therefore: Removing client-side `getResumeStep()` fixes the issue

**This proves:**
- Phase 0 analysis was correct
- The issue is NOT in middleware (middleware uses server client correctly)
- The issue is NOT in API routes (they use admin client correctly)
- The issue IS in client components calling `getResumeStep()` with browser client

---

## After Testing

Once you've confirmed kill-switch eliminates errors:

1. **Keep kill-switch ON** for now (temporary fix)
2. Proceed to **Phase 3:** Refactor client components to use API routes
3. **Phase 4:** Verify final fix with screenshots
4. **Remove kill-switch code** after Phase 3 is complete

---

## Troubleshooting

### "Environment variable not working"
- Did you restart the dev server?
- Check `.env.local` file for typos
- Use `console.log(process.env.NEXT_PUBLIC_DISABLE_CLIENT_RESUME_STEP)` to verify

### "Still seeing 400 errors with kill-switch ON"
- Check if there are other client components calling `getResumeStep()`
- Search codebase: `grep -r "getResumeStep" app/ components/`
- May need to add kill-switch to those files too

### "Test user short-circuit not working"
- Verify email matches exactly (case-sensitive)
- Check server console for middleware logs
- Environment variable must NOT have `NEXT_PUBLIC_` prefix (server-only)
