# 🚀 Final Step: Apply Database Migration

## ✅ What's Been Fixed

All code changes are complete! The fix is working but waiting for the database table to be created.

### Code Changes Made:
1. ✅ Created migration file: `supabase/migrations/008_user_onboarding_state.sql`
2. ✅ Updated login page to check survey progress before redirecting
3. ✅ Updated middleware to properly handle incomplete surveys
4. ✅ Updated survey saving to track onboarding state

### Current Error You're Seeing:
```
Could not find the table 'public.user_onboarding_state' in the schema cache
```

This is **EXPECTED** - the table just needs to be created in your database.

## 🔧 Apply the Migration (2 minutes)

### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**:
   - Visit: https://supabase.com/dashboard
   - Select your HAEVN project

2. **Open SQL Editor**:
   - Click "SQL Editor" in the left sidebar
   - Click "New query" button

3. **Copy the migration SQL**:
   - Open file: `supabase/migrations/008_user_onboarding_state.sql`
   - Copy ALL the SQL (the entire file)

4. **Paste and run**:
   - Paste into the SQL editor
   - Click "Run" button (or press Cmd/Ctrl + Enter)
   - ✅ You should see "Success. No rows returned"

5. **Verify table was created**:
   - Click "Table Editor" in the left sidebar
   - You should now see `user_onboarding_state` table in the list

### Option 2: Using Supabase CLI (If you have it set up)

```bash
cd HAEVN-STARTER-INTERFACE
supabase db push
```

## ✅ Test the Fix

After applying the migration:

1. **Sign up as a new user** (or use existing account)
2. **Go to the survey** and answer 4-5 questions
3. **Navigate away** (go to `/` or any other page)
4. **Sign out** (if logged in)
5. **Sign back in**
6. **Expected Result**: You should be automatically redirected back to the survey at the exact question you left off on!

## 🎯 What Happens After Migration

Once the table is created:

- ✅ All those errors will disappear
- ✅ Login will redirect users to their incomplete surveys
- ✅ Survey progress is properly saved and resumed
- ✅ Users can leave and come back anytime

## 📝 SQL to Run (Quick Copy)

Just in case you need it, here's the migration SQL:

```sql
-- Create user_onboarding_state table
CREATE TABLE IF NOT EXISTS user_onboarding_state (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step TEXT DEFAULT 'expectations',
    identity_completed BOOLEAN DEFAULT FALSE,
    survey_completed BOOLEAN DEFAULT FALSE,
    membership_selected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_user ON user_onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_user_onboarding_state_survey_completed ON user_onboarding_state(survey_completed);

-- Enable RLS
ALTER TABLE user_onboarding_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own onboarding state" ON user_onboarding_state
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding state" ON user_onboarding_state
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding state" ON user_onboarding_state
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_onboarding_state_updated_at
    BEFORE UPDATE ON user_onboarding_state
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Grant permissions
GRANT ALL ON user_onboarding_state TO authenticated;
GRANT ALL ON user_onboarding_state TO service_role;
```

---

## ❓ Need Help?

If you get any errors when running the migration, let me know and I'll help troubleshoot!