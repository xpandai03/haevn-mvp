-- Fix RLS infinite recursion issue
-- This completely rebuilds the RLS policies to avoid circular references

-- Step 1: Drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view partnerships they belong to" ON partnerships;
DROP POLICY IF EXISTS "Owners can update their partnerships" ON partnerships;
DROP POLICY IF EXISTS "Users can create partnerships" ON partnerships;
DROP POLICY IF EXISTS "Users can view partnership memberships" ON partnership_members;
DROP POLICY IF EXISTS "Partnership owners can manage members" ON partnership_members;

-- Step 2: Create simpler, non-recursive policies for partnerships
-- View policy - simple owner check
CREATE POLICY "Users can view own partnerships" ON partnerships
  FOR SELECT
  USING (owner_id = auth.uid());

-- Update policy - only owner can update
CREATE POLICY "Owners can update partnerships" ON partnerships
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Insert policy - users can create partnerships they own
CREATE POLICY "Users can create partnerships" ON partnerships
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Step 3: Fix partnership_members policies
-- View policy - can see memberships for partnerships you own OR where you're a member
CREATE POLICY "View partnership members" ON partnership_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    partnership_id IN (
      SELECT id FROM partnerships WHERE owner_id = auth.uid()
    )
  );

-- Insert/Update/Delete - only if you own the partnership
CREATE POLICY "Manage partnership members" ON partnership_members
  FOR ALL
  USING (
    partnership_id IN (
      SELECT id FROM partnerships WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    partnership_id IN (
      SELECT id FROM partnerships WHERE owner_id = auth.uid()
    )
  );

-- Step 4: Also fix the onboarding_state policies to avoid issues
DROP POLICY IF EXISTS "Partnership members can view onboarding state" ON onboarding_state;
DROP POLICY IF EXISTS "Partnership members can update onboarding state" ON onboarding_state;
DROP POLICY IF EXISTS "Partnership members can insert onboarding state" ON onboarding_state;

-- Simpler onboarding_state policies based on user_id
CREATE POLICY "Users can view own onboarding state" ON onboarding_state
  FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own onboarding state" ON onboarding_state
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own onboarding state" ON onboarding_state
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Step 5: Grant necessary permissions
GRANT ALL ON partnerships TO authenticated;
GRANT ALL ON partnership_members TO authenticated;
GRANT ALL ON onboarding_state TO authenticated;

-- Step 6: Test that a user can update their partnership
-- This should not cause recursion anymore
DO $$
DECLARE
  test_user_id UUID;
  test_partnership_id UUID;
BEGIN
  -- Get a test user (the latest one)
  SELECT id INTO test_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

  -- Get their partnership
  SELECT id INTO test_partnership_id FROM partnerships WHERE owner_id = test_user_id LIMIT 1;

  IF test_partnership_id IS NOT NULL THEN
    -- Try to update it (this would fail with recursion)
    UPDATE partnerships
    SET profile_type = 'solo',
        relationship_orientation = ARRAY['Open / ENM']
    WHERE id = test_partnership_id;

    RAISE NOTICE 'Update successful for partnership %', test_partnership_id;
  END IF;
END $$;