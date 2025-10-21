# 🧪 Test Guide: Server Cookie Clearing Fix

## 🎯 What We Fixed

**The Root Cause:**
- Client-side signOut cleared localStorage ✅
- Server-side getUserSurveyData read from HTTP cookies ❌
- Cookies weren't being cleared, so new users got old user_id

**The Fix:**
- Created server action `serverSignOut()` that clears cookies server-side
- Updated client signOut to call server action
- Added comprehensive logging to track client vs server state

---

## 🧰 Test Setup

### Prerequisites
1. Terminal running `npm run dev` (watch logs)
2. Browser DevTools open (F12)
   - Console tab for client logs
   - Application → Cookies tab to inspect cookies
3. Two unique email addresses ready (e.g., tester200@test.com, tester201@test.com)

---

## 🧪 Test 1: Verify Cookies Are Cleared on SignOut

### Steps

1. **Sign up as tester200@test.com**
   - Fill out signup form
   - Complete registration

2. **Check DevTools → Application → Cookies**
   - Look for cookies starting with `sb-`
   - Example: `sb-localhost-auth-token`
   - **Expected:** Cookies exist ✅

3. **Fill out a few survey questions**
   - Answer Q1-Q5
   - Wait for auto-save to complete

4. **Click Sign Out**

5. **Watch Terminal Logs** (should see):
   ```
   [Auth] 🚪 ===== STARTING SIGN OUT =====
   [Auth] Client-side user: abc-123-xxx
   [Auth] Client-side email: tester200@test.com
   [Auth] Step 1: Clearing localStorage...
   [Auth] ✅ localStorage cleared
   [Auth] Step 2: Calling client-side Supabase signOut...
   [Auth] ✅ Client-side signOut successful
   [Auth] Step 3: Calling server-side signOut to clear cookies...
   [serverSignOut] Starting server-side sign out...
   [serverSignOut] Current session user: abc-123-xxx
   [serverSignOut] Current session email: tester200@test.com
   [serverSignOut] Calling supabase.auth.signOut()...
   [serverSignOut] ✅ Supabase signOut successful
   [serverSignOut] Manually clearing auth cookies...
   [serverSignOut] Total cookies before cleanup: 3
   [serverSignOut] Deleting cookie: sb-localhost-auth-token
   [serverSignOut] Deleting cookie: sb-localhost-auth-token-code-verifier
   [serverSignOut] Cleared 2 auth cookies  ← CRITICAL!
   [serverSignOut] ✅ Server-side sign out complete
   [serverSignOut] Session cleared: true
   [Auth] ✅ Server-side signOut successful (cookies cleared)
   [Auth] Step 4: Forcing React state clear...
   [Auth] ✅ React state cleared
   [Auth] ✅ ===== SIGN OUT COMPLETE =====
   ```

6. **Check DevTools → Application → Cookies again**
   - **Expected:** All `sb-*` cookies should be GONE ✅
   - **If cookies remain:** ❌ Fix didn't work

### ✅ Pass Criteria

- [ ] Terminal shows "Cleared X auth cookies" (X > 0)
- [ ] Terminal shows "Session cleared: true"
- [ ] DevTools shows NO cookies starting with `sb-`
- [ ] No errors in terminal logs

---

## 🧪 Test 2: Verify New User Gets New user_id

### Steps

1. **Immediately after Test 1, sign up as tester201@test.com**
   - Use a DIFFERENT email
   - Complete registration

2. **Watch Terminal Logs** (should see):
   ```
   [Signup Page] ===== STARTING SIGNUP =====
   [Signup Page] Email: tester201@test.com
   [Signup Page] Calling signUp...
   [Auth] 🆕 Starting signup for: tester201@test.com
   [Auth] Current user before signup: null  ← CRITICAL: Should be null!
   [Auth] ✅ Signup successful!
   [Auth] New user ID: xyz-789-NEW  ← Note this ID
   [Signup Page] ✅ SignUp successful!
   [Signup Page] New user ID: xyz-789-NEW
   [Signup Page] Calling signIn for auto-login...
   [Auth] 🔐 Starting sign in for: tester201@test.com
   [Auth] ✅ Sign in successful!
   [Auth] User ID: xyz-789-NEW  ← Same NEW ID
   [Auth] ===== AUTH STATE CHANGE =====
   [Auth] Event: SIGNED_IN
   [Auth] Session: { userId: 'xyz-789-NEW', email: 'tester201@test.com' }
   ```

3. **Go to /onboarding/survey**

4. **Watch Terminal Logs** (should see):
   ```
   [getUserSurveyData] ===== SERVER-SIDE SURVEY DATA REQUEST =====
   [getUserSurveyData] Checking server-side session...
   [getUserSurveyData] Server session exists: true
   [getUserSurveyData] Session user ID: xyz-789-NEW  ← Same NEW ID!
   [getUserSurveyData] Session email: tester201@test.com  ← New email!
   [getUserSurveyData] ✅ Server-side user authenticated
   [getUserSurveyData] User ID: xyz-789-NEW
   [getUserSurveyData] User email: tester201@test.com
   [getUserSurveyData] Querying user_survey_responses for user_id: xyz-789-NEW
   [getUserSurveyData] No existing data found - creating empty survey  ← CRITICAL!
   ```

5. **Check Browser**
   - Survey should start at Q1
   - NO pre-filled answers
   - Completion: 0%

### ✅ Pass Criteria

- [ ] "Current user before signup: null" (not an old user ID)
- [ ] New user ID is DIFFERENT from tester200's ID
- [ ] Server-side session shows NEW user ID
- [ ] "No existing data found" in logs
- [ ] Survey is empty in browser

---

## 🧪 Test 3: Verify Server vs Client State Sync

### Steps

1. **Sign up as tester202@test.com**

2. **Open Browser Console, run:**
   ```javascript
   // Check client-side state
   localStorage.getItem('haevn-auth')
   ```
   - Should show session data with user_id

3. **Watch Terminal, check for:**
   ```
   [getUserSurveyData] Session user ID: <same-id-as-client>
   ```

4. **Sign out**

5. **Run in Browser Console:**
   ```javascript
   // Should be null
   localStorage.getItem('haevn-auth')
   ```

6. **Check DevTools → Application → Cookies**
   - All `sb-*` cookies should be gone

### ✅ Pass Criteria

- [ ] Client localStorage user_id matches server session user_id
- [ ] After signOut, localStorage is null
- [ ] After signOut, cookies are deleted
- [ ] No mismatch between client and server state

---

## 🚨 Common Issues & Debugging

### Issue 1: Cookies Not Deleted

**Symptoms:**
```
[serverSignOut] Cleared 0 auth cookies
```

**Diagnosis:**
- Check cookie names in DevTools
- They might not match the `sb-*-auth*` pattern

**Fix:**
- Update the cookie name pattern in `lib/actions/auth.ts:serverSignOut()`

### Issue 2: Old user_id Still Appears

**Symptoms:**
```
[Auth] Current user before signup: abc-123-OLD  ← Should be null!
[getUserSurveyData] Session user ID: abc-123-OLD  ← Old ID!
```

**Diagnosis:**
- Server cookies weren't cleared
- Supabase client is loading cached session

**Fix:**
- Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
- Clear all site data in DevTools → Application → Clear site data
- Restart dev server: `npm run dev`

### Issue 3: Session Still Exists After signOut

**Symptoms:**
```
[serverSignOut] ⚠️ Session still exists after signOut!
[serverSignOut] Session user: abc-123-xxx
```

**Diagnosis:**
- Supabase signOut failed
- Cookies weren't manually cleared

**Fix:**
- Check for errors in `supabase.auth.signOut()` call
- Verify manual cookie deletion is working
- Check cookie sameSite/secure settings

---

## 📊 Expected Log Flow (Complete Cycle)

### User A Signs Up
```
[Signup Page] Email: tester200@test.com
[Auth] New user ID: aaa-111
[getUserSurveyData] Server session user ID: aaa-111
[getUserSurveyData] No existing data found
```

### User A Signs Out
```
[Auth] ===== STARTING SIGN OUT =====
[serverSignOut] Cleared 2 auth cookies
[serverSignOut] Session cleared: true
[Auth] ===== SIGN OUT COMPLETE =====
```

### User B Signs Up
```
[Signup Page] Email: tester201@test.com
[Auth] Current user before signup: null  ← Not aaa-111!
[Auth] New user ID: bbb-222  ← Different!
[getUserSurveyData] Server session user ID: bbb-222  ← New user!
[getUserSurveyData] No existing data found
```

**✅ Success:** Different user IDs, no data leakage!

---

## 🎯 Final Verification

After running all 3 tests, verify:

1. **Different user IDs:**
   - tester200: `aaa-111`
   - tester201: `bbb-222`
   - tester202: `ccc-333`

2. **Each user has separate data:**
   ```sql
   SELECT user_id, email, completion_pct
   FROM user_survey_responses
   JOIN auth.users ON user_survey_responses.user_id = auth.users.id;
   ```
   Should show 3 separate rows

3. **No cookies after signOut:**
   - DevTools → Cookies should be empty

4. **No errors in logs:**
   - All signOut steps complete successfully
   - No "Session still exists" warnings

---

## ✅ Success Criteria

**The fix is working if:**

1. ✅ `serverSignOut()` logs "Cleared X auth cookies" where X > 0
2. ✅ DevTools shows no `sb-*` cookies after signOut
3. ✅ New signups get "Current user before signup: null"
4. ✅ Each email gets a unique user_id
5. ✅ Server-side session matches client-side user_id
6. ✅ New users see "No existing data found"
7. ✅ Survey starts empty for new users

**If ANY of these fail, the bug persists!**

---

## 📝 Quick Checklist

```
□ Test 1: Cookies cleared on signOut
  □ Terminal shows "Cleared X auth cookies"
  □ DevTools shows no sb-* cookies
  □ No errors in logs

□ Test 2: New user gets new ID
  □ "Current user before signup: null"
  □ New user_id different from previous
  □ Server session shows new ID
  □ "No existing data found"
  □ Survey is empty

□ Test 3: Client/server sync
  □ localStorage user_id matches server
  □ After signOut, both cleared
  □ No state mismatch

□ Final verification
  □ 3 users = 3 unique IDs
  □ 3 separate database rows
  □ No cookies remain
  □ No console errors
```

---

**Test Time:** ~15 minutes for complete verification
**Fix Type:** Server-side session management
**Severity:** CRITICAL (data privacy)
**Status:** ✅ **IMPLEMENTED - READY FOR TESTING**

**Related Docs:**
- See `ROOT-CAUSE-SESSION-PERSISTENCE.md` for technical explanation
- See `FIX-USER-DATA-LEAKAGE.md` for React state clearing
- See `FIX-AUTH-STATE-PERSISTENCE.md` for localStorage clearing

This is the FINAL fix for the user_id persistence bug!
