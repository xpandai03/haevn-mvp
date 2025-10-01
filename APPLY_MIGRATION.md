# Apply User Onboarding State Migration

## Quick Apply (Using Supabase Dashboard)

1. **Open Supabase SQL Editor**:
   - Go to https://supabase.com/dashboard
   - Select your HAEVN project
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

2. **Copy and paste the migration**:
   ```sql
   -- Copy the entire contents of:
   -- supabase/migrations/008_user_onboarding_state.sql
   ```

3. **Run the migration**:
   - Click "Run" button
   - Verify no errors appear
   - Confirm table created in "Table Editor"

## Verify Migration

After running, verify the table exists:

```sql
SELECT * FROM user_onboarding_state LIMIT 1;
```

## Test the Fix

1. **Sign up as new user**: `test@example.com`
2. **Answer 4-5 survey questions**
3. **Click "Save & Exit"**
4. **Sign out**
5. **Sign back in**
6. **Expected**: You should be redirected to the survey and resume at question 5 or 6

## What This Fix Does

✅ Creates `user_onboarding_state` table to track user progress
✅ Login page now checks survey completion before redirecting
✅ Middleware properly handles incomplete surveys
✅ Survey auto-saves create/update onboarding state on every answer

## Files Changed

- `/supabase/migrations/008_user_onboarding_state.sql` (NEW)
- `/app/auth/login/page.tsx` (UPDATED - smart redirect)
- `/middleware.ts` (UPDATED - survey-first checking)
- `/lib/actions/survey-user.ts` (UPDATED - state tracking)

## Troubleshooting

If migration fails with "table already exists":
```sql
DROP TABLE IF EXISTS user_onboarding_state CASCADE;
-- Then re-run the migration
```

If you get RLS policy errors:
```sql
ALTER TABLE user_onboarding_state ENABLE ROW LEVEL SECURITY;
-- Then re-run just the policy statements
```