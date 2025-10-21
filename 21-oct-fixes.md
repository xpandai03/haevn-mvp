# October 21, 2025 - Critical Fixes Plan

## Overview
This document outlines 4 critical issues identified during production testing and provides detailed investigation findings and fix plans for each.

---

## Issue #1: Dashboard Session Timeout (~30 seconds)

### Problem Statement
Users who have completed the survey and have dashboard access get automatically logged out after approximately 30 seconds of being on the dashboard.

### User Feedback
> "when i login as an existing user (completed survey + w dashboard access) i go to the dashboard and stay there for about 30s but keep getting logged out"

### Root Cause Investigation

**Potential Causes:**
1. **Token Expiration**: Supabase JWT tokens may be expiring quickly
2. **Missing Auto-Refresh**: Session refresh mechanism not properly configured
3. **Cookie Configuration**: Cookies may not be persisting correctly (sameSite, secure flags)
4. **Auth State Change Handler**: May be incorrectly triggering logout events

**Evidence:**
- `lib/auth/context.tsx` has `refreshSession()` function but it's reactive (only on TOKEN_REFRESHED event)
- No proactive token refresh interval detected
- Auth listener handles TOKEN_REFRESHED but doesn't initiate refresh

### Fix Plan

**Priority: CRITICAL** ⚠️

#### Step 1: Verify Token Expiration Settings
```typescript
// Check in Supabase Dashboard:
// Project Settings → Auth → JWT Expiry
// Should be: 3600 (1 hour) minimum
```

#### Step 2: Add Proactive Session Refresh
**File:** `lib/auth/context.tsx`

Add automatic session refresh before token expires:

```typescript
useEffect(() => {
  if (!session) return

  // Refresh session every 50 minutes (before 1 hour expiry)
  const refreshInterval = setInterval(async () => {
    console.log('[Auth] Proactive token refresh...')
    await refreshSession()
  }, 50 * 60 * 1000) // 50 minutes

  return () => clearInterval(refreshInterval)
}, [session])
```

#### Step 3: Verify Supabase Client Cookie Config
**File:** `lib/supabase/client.ts`

Ensure cookies are configured for persistence:

```typescript
createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      get: (name) => getCookie(name),
      set: (name, value, options) => {
        setCookie(name, value, {
          ...options,
          sameSite: 'lax', // Important for auth
          secure: process.env.NODE_ENV === 'production',
          path: '/'
        })
      },
      remove: (name, options) => deleteCookie(name, options)
    }
  }
)
```

#### Step 4: Add Session Validation on Dashboard Mount
**File:** `app/dashboard/page.tsx`

```typescript
useEffect(() => {
  const validateSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    if (!session || error) {
      console.error('[Dashboard] Invalid session:', error)
      router.push('/auth/login')
    }
  }

  validateSession()
}, [])
```

#### Testing Steps
1. Login as existing user
2. Navigate to dashboard
3. Wait 2 minutes (stay active on page)
4. Verify session is still valid
5. Check browser console for TOKEN_REFRESHED events
6. Verify no automatic logout occurs

---

## Issue #2: Identity Page Data Not Saving

### Problem Statement
User selections on `/onboarding/identity` page (profile type and relationship orientation) are not being saved or loaded when returning to the page.

### User Feedback
> "the users answer for https://haevn-mvp.vercel.app/onboarding/identity is not getting saved in some cases (it should be just like the survey anwers are saved)"

### Root Cause Investigation

**File:** `app/onboarding/identity/page.tsx`

**Finding:**
- ✅ SAVE logic exists (lines 56-72) - saves to `partnerships` table on submit
- ❌ LOAD logic MISSING - no useEffect to load existing data
- ❌ No persistence when navigating back to the page

**Evidence:**
```typescript
// Current code ONLY saves on submit:
const handleContinue = async () => {
  const { error } = await supabase
    .from('partnerships')
    .update({
      profile_type: profileType,
      relationship_orientation: relationshipOrientation
    })
    .eq('id', partnership.id)
}

// But NO code to LOAD existing data on mount
```

### Fix Plan

**Priority: HIGH** 🔴

#### Step 1: Add Data Loading on Mount
**File:** `app/onboarding/identity/page.tsx`

Add after existing useEffect blocks:

```typescript
// Load existing identity data
useEffect(() => {
  async function loadIdentityData() {
    if (!user) return

    try {
      console.log('[Identity] Loading existing data for user:', user.id)

      const { data: partnership, error } = await supabase
        .from('partnerships')
        .select('profile_type, relationship_orientation')
        .eq('primary_user_id', user.id)
        .single()

      if (error) {
        console.error('[Identity] Error loading data:', error)
        return
      }

      if (partnership) {
        console.log('[Identity] Loaded:', partnership)
        setProfileType(partnership.profile_type as ProfileType)
        setRelationshipOrientation(partnership.relationship_orientation as RelationshipOrientation)
      }
    } catch (error) {
      console.error('[Identity] Failed to load identity data:', error)
    }
  }

  loadIdentityData()
}, [user, supabase])
```

#### Step 2: Create Partnership Record if Missing
Update `handleContinue` to INSERT if no partnership exists:

```typescript
const handleContinue = async () => {
  if (!user || !profileType || !relationshipOrientation) {
    // ... validation
  }

  setIsSubmitting(true)
  try {
    const { data: partnership } = await supabase
      .from('partnerships')
      .select('id')
      .eq('primary_user_id', user.id)
      .maybeSingle() // Use maybeSingle instead of single

    if (partnership) {
      // UPDATE existing
      const { error } = await supabase
        .from('partnerships')
        .update({
          profile_type: profileType,
          relationship_orientation: relationshipOrientation,
          updated_at: new Date().toISOString()
        })
        .eq('id', partnership.id)
      if (error) throw error
    } else {
      // INSERT new
      const { error } = await supabase
        .from('partnerships')
        .insert({
          primary_user_id: user.id,
          profile_type: profileType,
          relationship_orientation: relationshipOrientation
        })
      if (error) throw error
    }

    await flowController.markStepComplete(user.id, 4)
    router.push('/onboarding/verification')
  } catch (error) {
    // ... error handling
  }
}
```

#### Testing Steps
1. Navigate to `/onboarding/identity`
2. Select profile type and relationship orientation
3. Click Continue
4. Use browser back button to return to identity page
5. Verify selections are still displayed
6. Check database `partnerships` table for saved data

---

## Issue #3: Veriff Redirect to ngrok (Dead URL)

### Problem Statement
After completing Veriff verification, users are redirected to a hardcoded ngrok development URL that is no longer accessible, causing an error with no way to return to the app.

### User Feedback
> "after finished or exiting the veriff verification, we are sent to this page: https://36169a977600.ngrok-free.app/onboarding/survey-intro which throws an error showing on the screenshot and there is no way to return to the main app"

### Root Cause Investigation

**File:** `lib/veriff.ts` (line 85)

**Finding:**
```typescript
const payload = {
  verification: {
    callback: "https://36169a977600.ngrok-free.app/onboarding/survey-intro",  // ❌ HARDCODED!
    vendorData: userId,
    timestamp: new Date().toISOString()
  }
}
```

**Why This Happened:**
- During development on Oct 17, ngrok tunnel was used for local testing
- Hardcoded URL was left in code instead of using environment variable
- ngrok URLs are temporary and expire
- Environment variable `VERIFF_RETURN_URL` exists but is NOT being used in callback

### Fix Plan

**Priority: CRITICAL** ⚠️

#### Step 1: Replace Hardcoded URL with Environment Variable
**File:** `lib/veriff.ts` (line 85)

**Current (BROKEN):**
```typescript
const payload = {
  verification: {
    callback: "https://36169a977600.ngrok-free.app/onboarding/survey-intro",
    vendorData: userId,
    timestamp: new Date().toISOString()
  }
}
```

**Fixed:**
```typescript
const payload = {
  verification: {
    callback: VERIFF_RETURN_URL, // Use the env var that's already defined!
    vendorData: userId,
    timestamp: new Date().toISOString()
  }
}
```

#### Step 2: Update Vercel Environment Variable
In Vercel Dashboard → Settings → Environment Variables:

**Update:**
```bash
VERIFF_RETURN_URL=https://haevn-mvp.vercel.app/onboarding/verification/return
```

**Note:** The return URL should be `/onboarding/verification/return` NOT `/onboarding/survey-intro` because:
- `verification/return` page handles Veriff callback properly
- Polls for verification status
- Shows appropriate success/failure states
- Has logic to redirect to survey-intro after verification

#### Step 3: Verify Return Page Flow
**File:** `app/onboarding/verification/return/page.tsx`

Ensure the redirect chain is correct:
```
Veriff Complete → /verification/return → (polls status) → /survey-intro
```

Lines 76-78 already handle this:
```typescript
setTimeout(() => {
  router.push('/onboarding/survey-intro')
}, 2000)
```

#### Testing Steps
1. Start verification flow from `/onboarding/verification`
2. Complete Veriff verification (or cancel)
3. Verify redirect goes to `https://haevn-mvp.vercel.app/onboarding/verification/return`
4. Verify page shows status checking animation
5. Verify auto-redirect to `/onboarding/survey-intro` after status check
6. Check browser console for correct callback URL being used

---

## Issue #4: Kinsey Scale Partner Preference Question Format

### Problem Statement
Question 7 in "Basic Information" section asks "Do you prefer partners with a particular Kinsey-scale range?" but uses a text input instead of a checklist with the same Kinsey scale options.

### User Feedback
> "the Basic Information Question 7 of 8 'Do you prefer partners with a particular Kinsey-sc' question should have a checklist user can select from that looks just like this questions list for defining the kinsey scale"

With reference image showing Kinsey Scale options:
- 0 - Exclusively heterosexual
- 1 - Predominantly heterosexual, only incidentally homosexual
- 2 - Predominantly heterosexual, but more than incidentally homosexual
- 3 - Equally heterosexual and homosexual (bisexual)
- 4 - Predominantly homosexual, but more than incidentally heterosexual
- 5 - Predominantly homosexual, only incidentally heterosexual
- 6 - Exclusively homosexual

### Root Cause Investigation

**File:** `lib/survey/questions.ts` (lines 130-139)

**Current Implementation:**
```typescript
{
  id: 'q3c_partner_kinsey_preference',
  label: 'Do you prefer partners with a particular Kinsey-scale range?',
  type: 'text', // ❌ Wrong type!
  placeholder: 'e.g., 2-4, or no preference',
  required: false,
  helperText: 'Only answer if you have a preference; many people don\'t.',
  skipCondition: (answers) =>
    answers.q3b_kinsey_scale === undefined ||
    answers.q3b_kinsey_scale === null
}
```

**Issue:**
- Uses `type: 'text'` - free-form text input
- Should use `type: 'multiselect'` - checkbox list
- Should have same options as `q3b_kinsey_scale` question

### Fix Plan

**Priority: MEDIUM** 🟡

#### Step 1: Change Question Type to Multiselect
**File:** `lib/survey/questions.ts` (lines 130-139)

**Replace with:**
```typescript
{
  id: 'q3c_partner_kinsey_preference',
  csvId: 'Q3c',
  label: 'Do you prefer partners with a particular Kinsey scale position?',
  type: 'multiselect', // ✅ Changed from 'text' to 'multiselect'
  required: false,
  helperText: 'Select all that apply. Leave blank if you have no preference.',
  options: [
    '0 - Exclusively heterosexual',
    '1 - Predominantly heterosexual, only incidentally homosexual',
    '2 - Predominantly heterosexual, but more than incidentally homosexual',
    '3 - Equally heterosexual and homosexual (bisexual)',
    '4 - Predominantly homosexual, but more than incidentally heterosexual',
    '5 - Predominantly homosexual, only incidentally heterosexual',
    '6 - Exclusively homosexual',
    'No preference' // Add this option
  ],
  displayLogic: "Show if Q3 in {Bisexual,Pansexual,Queer,Fluid,Other}"
}
```

#### Step 2: Remove skipCondition (Replaced by displayLogic)
The `skipCondition` that checks for `q3b_kinsey_scale` is no longer needed because:
- Both questions now use the same `displayLogic`
- They show for the same user types (non-monosexual orientations)
- Multiselect allows users to select nothing (no preference)

#### Step 3: Update QuestionRenderer to Support Kinsey Options
**File:** `components/survey/QuestionRenderer.tsx`

Verify multiselect rendering properly displays all 7 Kinsey scale options + "No preference" option with proper checkbox styling matching the reference image.

#### Step 4: Add "No Preference" Handling
Update the question logic to make "No preference" exclusive (deselects others when selected):

```typescript
// In QuestionRenderer multiselect handler:
const handleMultiselectChange = (value: string, checked: boolean) => {
  let newValues: string[] = currentValue || []

  if (value === 'No preference') {
    // If "No preference" selected, clear all other selections
    newValues = checked ? ['No preference'] : []
  } else {
    // If any other option selected, remove "No preference"
    newValues = newValues.filter(v => v !== 'No preference')

    if (checked) {
      newValues.push(value)
    } else {
      newValues = newValues.filter(v => v !== value)
    }
  }

  onChange(newValues)
}
```

#### Testing Steps
1. Answer Q3 as "Bisexual" to trigger Q3c display
2. Navigate to Q3c partner preference question
3. Verify it shows as a checklist with 8 options (7 Kinsey + No preference)
4. Select multiple options (e.g., 2, 3, 4)
5. Click "No preference" - verify it deselects others
6. Save and verify data persists correctly
7. Check that visual styling matches reference image

---

## Implementation Order

### Phase 1: Critical Fixes (Deploy ASAP)
1. ✅ **Issue #3** - Veriff redirect (5 min fix, highest user impact)
2. ⚠️ **Issue #1** - Session timeout (30 min, blocking dashboard usage)

### Phase 2: High Priority
3. 🔴 **Issue #2** - Identity data not saving (20 min, data loss issue)

### Phase 3: Enhancement
4. 🟡 **Issue #4** - Kinsey scale UI (15 min, UX improvement)

---

## Testing Checklist

### Pre-Deployment
- [ ] All code changes reviewed
- [ ] Environment variables updated in Vercel
- [ ] Local testing completed for each fix
- [ ] No TypeScript errors
- [ ] No console errors in browser

### Post-Deployment
- [ ] **Issue #1**: Login → Dashboard → Wait 2 min → Still logged in
- [ ] **Issue #2**: Identity page → Select options → Back → Options persist
- [ ] **Issue #3**: Veriff flow → Complete → Redirects to production URL
- [ ] **Issue #4**: Q3c shows as checklist with 8 options
- [ ] Full onboarding flow: Signup → Identity → Verification → Survey → Celebration → Membership → Dashboard

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate**: Revert git commits
   ```bash
   git revert HEAD~4..HEAD
   git push
   ```

2. **Environment Variables**: Keep backup of old values
   ```bash
   VERIFF_RETURN_URL_OLD=https://36169a977600.ngrok-free.app/onboarding/survey-intro
   ```

3. **Database**: No schema changes in these fixes - no rollback needed

---

## Notes

- All fixes are backward compatible
- No database migrations required
- Can be deployed incrementally
- Session timeout fix may require users to re-login once
- Veriff fix requires Vercel env var update + redeploy

---

**Document Created:** October 21, 2025
**Status:** Ready for Implementation
**Estimated Total Time:** 70 minutes
