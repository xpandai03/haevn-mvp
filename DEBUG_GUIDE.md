# Debug Guide - Fix Partnership & Survey Issues

## What We've Done

1. **Added detailed logging** to the partnership service to track exactly where failures occur
2. **Created debug SQL scripts** to inspect database state
3. **Fixed RLS policies** to ensure users can create and manage partnerships
4. **Created a debug API endpoint** to test partnership creation in isolation

## Step-by-Step Testing Instructions

### Step 1: Run the RLS Policy Fix
1. Go to Supabase SQL Editor
2. Run the contents of `/supabase/fix-rls-policies.sql`
3. This will reset and fix all Row Level Security policies

### Step 2: Check Your Current Database State
1. In Supabase SQL Editor, run `/supabase/debug-partnerships.sql`
2. Replace `'your-test-email@example.com'` with your actual test email
3. This will show you:
   - If your user has a profile
   - Table structures
   - RLS policies
   - Existing partnerships

### Step 3: Test the Debug API Endpoint
1. Make sure your app is running (`npm run dev`)
2. Log in to your app
3. In your browser, visit: `http://localhost:3000/api/debug/partnership`
4. This will show you the current state of your user's partnership data

### Step 4: Try Creating a Partnership via API
1. Open browser console (F12)
2. Run this command:
   ```javascript
   fetch('/api/debug/partnership', { method: 'POST' })
     .then(r => r.json())
     .then(console.log)
   ```
3. Check the response - it will show exactly where the creation fails

### Step 5: Check Browser Console Logs
1. Go to `/onboarding/survey`
2. Open browser console (F12)
3. Look for logs starting with `[Partnership]` and `[Survey]`
4. These will show the exact failure points

## Common Issues & Solutions

### Issue 1: "column 'user_id' does not exist"
**Solution**: The survey_responses table should use partnership_id, not user_id. This is already fixed in our schema.

### Issue 2: "permission denied for table partnerships"
**Solution**: Run the RLS policy fix script (Step 1 above)

### Issue 3: Profile doesn't exist
**Solution**: The profile should be created automatically on signup. Check if the trigger is working:
```sql
SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';
```

### Issue 4: UUID extension missing
**Solution**: Run this in Supabase:
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Quick Reset (Nuclear Option)
If nothing else works, run this sequence:
1. `/supabase/cleanup-test-data.sql` - Clear all data
2. `/supabase/fix-partnerships.sql` - Recreate tables
3. `/supabase/survey-setup-fixed.sql` - Setup survey tables
4. `/supabase/fix-rls-policies.sql` - Fix permissions
5. Sign up with a new test account

## Expected Flow
1. User signs up → Profile created automatically
2. User redirected to `/onboarding/survey`
3. Partnership created on first visit
4. Survey loads with empty responses
5. User completes survey → Saved to database
6. User can access dashboard

## Current Status
✅ Fixed partnership table schema
✅ Fixed survey_responses table (no user_id column)
✅ Added comprehensive logging
✅ Fixed RLS policies
🔧 Testing partnership creation flow

## Next Steps
After running the debug steps above, check:
1. What errors appear in browser console?
2. What does the debug API endpoint return?
3. Are there any specific Supabase errors?

Share these results to continue debugging!