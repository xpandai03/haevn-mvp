# Onboarding State Fix Instructions

## Problem Solved
This fix resolves the issue where users had to repeat the identity step every time they logged in, and survey progress wasn't being tracked properly across sessions.

## What This Fix Does
1. Creates a user-based onboarding state tracking system
2. Tracks which onboarding steps each user has completed
3. Ensures users skip completed steps when they return
4. Properly saves survey progress to individual users

## Installation Steps

### Step 1: Run the Onboarding State Migration
1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy the entire contents of `FIX_ONBOARDING_STATE.sql`
4. Paste and click "Run"
5. You should see: "Onboarding state tracking fixed! Users will now skip completed steps."

### Step 2: Verify Survey Table (Should Already Be Done)
If you haven't already run the survey migration:
1. In SQL Editor, copy contents of `FIX_SURVEY_SAVE.sql`
2. Paste and click "Run"
3. You should see: "Migration completed successfully! Survey saving is now fixed."

### Step 3: Test the Installation
1. In SQL Editor, copy contents of `TEST_ONBOARDING_STATE.sql`
2. Paste and click "Run"
3. You should see:
   - Two "true" values indicating tables exist
   - A list of your users with their onboarding state
   - A success message

## How It Works Now

### For New Users:
1. Sign up → Go to identity page
2. Complete identity → State saved, go to survey intro
3. Start survey → Progress saves automatically
4. Leave and come back → Resume exactly where they left off
5. Complete survey → State saved, go to membership
6. Select membership → Complete onboarding

### For Existing Users:
- If they completed identity before, they'll skip it
- If they started the survey, they'll resume from their last question
- If they completed everything, they'll go straight to dashboard

## Testing the Fix

1. **Test Resume Functionality:**
   - Start the survey, answer a few questions
   - Click "Save & Exit"
   - Log out and log back in
   - You should go directly to the survey at your last question

2. **Test Skip Completed Steps:**
   - Complete the identity step
   - Log out and log back in
   - You should skip identity and go to survey intro

3. **Test Full Completion:**
   - Complete all onboarding steps
   - Log out and log back in
   - You should go directly to the dashboard

## Troubleshooting

### If users still repeat identity step:
1. Check that `FIX_ONBOARDING_STATE.sql` ran successfully
2. Run `TEST_ONBOARDING_STATE.sql` to verify tables exist
3. Check browser console for any errors

### If survey progress doesn't save:
1. Verify `FIX_SURVEY_SAVE.sql` ran successfully
2. Check that auto-save indicator shows "Saved" in survey
3. Check browser console for any save errors

### If middleware redirects incorrectly:
1. Clear browser cache and cookies
2. Try in incognito/private mode
3. Check that both migrations completed

## Files Changed
- `middleware.ts` - Now checks user_onboarding_state table
- `lib/actions/onboarding-state.ts` - New file for state management
- `lib/actions/survey-user.ts` - Updates user_onboarding_state on completion
- `app/onboarding/identity/page.tsx` - Saves completion status
- `app/onboarding/membership/page.tsx` - Saves completion status

## Success Indicators
✅ Users skip completed onboarding steps
✅ Survey progress saves and resumes correctly
✅ Identity selection is remembered
✅ Membership selection completes onboarding
✅ Returning users go straight to dashboard