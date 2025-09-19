-- FINAL FIX for RLS recursion issues
-- Run this in Supabase SQL Editor

-- 1. Drop ALL existing RLS policies to start fresh
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop all policies on partnerships
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'partnerships')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON partnerships', r.policyname);
  END LOOP;

  -- Drop all policies on partnership_members
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'partnership_members')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON partnership_members', r.policyname);
  END LOOP;

  -- Drop all policies on survey_responses
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'survey_responses')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON survey_responses', r.policyname);
  END LOOP;

  -- Drop all policies on profiles
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- 2. Temporarily disable RLS
ALTER TABLE partnerships DISABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 3. Create SIMPLE, NON-RECURSIVE policies

-- Profiles policies (simplest - just check user_id)
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Partnerships policies (check owner_id directly)
CREATE POLICY "partnerships_select" ON partnerships
  FOR SELECT USING (
    owner_id = auth.uid()
  );

CREATE POLICY "partnerships_insert" ON partnerships
  FOR INSERT WITH CHECK (
    owner_id = auth.uid()
  );

CREATE POLICY "partnerships_update" ON partnerships
  FOR UPDATE USING (
    owner_id = auth.uid()
  );

-- Partnership members policies (check user_id directly)
CREATE POLICY "members_select" ON partnership_members
  FOR SELECT USING (
    user_id = auth.uid()
  );

CREATE POLICY "members_insert" ON partnership_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "members_update" ON partnership_members
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Survey responses - use a function to avoid recursion
CREATE OR REPLACE FUNCTION user_owns_partnership(p_partnership_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM partnerships
    WHERE id = p_partnership_id
    AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "survey_select" ON survey_responses
  FOR SELECT USING (
    user_owns_partnership(partnership_id)
  );

CREATE POLICY "survey_insert" ON survey_responses
  FOR INSERT WITH CHECK (
    user_owns_partnership(partnership_id)
  );

CREATE POLICY "survey_update" ON survey_responses
  FOR UPDATE USING (
    user_owns_partnership(partnership_id)
  );

-- 4. Re-enable RLS
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 5. Ensure current_step column exists
ALTER TABLE survey_responses
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;

-- 6. Create helper function for getting/creating partnerships
CREATE OR REPLACE FUNCTION get_or_create_partnership(p_user_id UUID)
RETURNS TABLE (partnership_id UUID) AS $$
DECLARE
  v_partnership_id UUID;
  v_user_email TEXT;
BEGIN
  -- Check if user has a partnership
  SELECT p.id INTO v_partnership_id
  FROM partnerships p
  WHERE p.owner_id = p_user_id
  LIMIT 1;

  IF v_partnership_id IS NOT NULL THEN
    RETURN QUERY SELECT v_partnership_id;
    RETURN;
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = p_user_id;

  -- Create profile if needed
  INSERT INTO profiles (user_id, email, full_name, city, msa_status, survey_complete)
  VALUES (p_user_id, v_user_email, 'User', 'New York', 'live', false)
  ON CONFLICT (user_id) DO NOTHING;

  -- Create partnership
  INSERT INTO partnerships (owner_id, city, membership_tier)
  VALUES (p_user_id, 'New York', 'free')
  RETURNING id INTO v_partnership_id;

  -- Add as member
  INSERT INTO partnership_members (partnership_id, user_id, role)
  VALUES (v_partnership_id, p_user_id, 'owner');

  -- Create survey response
  INSERT INTO survey_responses (partnership_id, answers_json, completion_pct, current_step)
  VALUES (v_partnership_id, '{}', 0, 0)
  ON CONFLICT (partnership_id) DO NOTHING;

  RETURN QUERY SELECT v_partnership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_or_create_partnership TO authenticated;
GRANT EXECUTE ON FUNCTION user_owns_partnership TO authenticated;

-- 7. Test with current user
DO $$
DECLARE
  v_user_id UUID;
  v_partnership_id UUID;
BEGIN
  -- Get most recent user
  SELECT id INTO v_user_id
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Get or create partnership
    SELECT partnership_id INTO v_partnership_id
    FROM get_or_create_partnership(v_user_id);

    RAISE NOTICE 'User % has partnership %', v_user_id, v_partnership_id;
  END IF;
END $$;

-- 8. Verify the setup
SELECT
  u.email,
  p.id as partnership_id,
  pm.role,
  sr.completion_pct,
  sr.current_step
FROM auth.users u
LEFT JOIN partnerships p ON p.owner_id = u.id
LEFT JOIN partnership_members pm ON pm.partnership_id = p.id AND pm.user_id = u.id
LEFT JOIN survey_responses sr ON sr.partnership_id = p.id
ORDER BY u.created_at DESC
LIMIT 5;