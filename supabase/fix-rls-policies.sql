-- Fix RLS policies for partnerships system

-- First, disable RLS temporarily to clean up
ALTER TABLE public.partnerships DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view partnerships they belong to" ON public.partnerships;
DROP POLICY IF EXISTS "Users can update own partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "Users can create partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "Users can delete own partnerships" ON public.partnerships;

DROP POLICY IF EXISTS "Users can view own memberships" ON public.partnership_members;
DROP POLICY IF EXISTS "Users can create memberships" ON public.partnership_members;
DROP POLICY IF EXISTS "Users can update own memberships" ON public.partnership_members;
DROP POLICY IF EXISTS "Users can delete own memberships" ON public.partnership_members;

DROP POLICY IF EXISTS "Users can view own survey" ON public.survey_responses;
DROP POLICY IF EXISTS "Users can update own survey" ON public.survey_responses;
DROP POLICY IF EXISTS "Users can insert own survey" ON public.survey_responses;
DROP POLICY IF EXISTS "Users can delete own survey" ON public.survey_responses;

-- Re-enable RLS
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;

-- Partnerships table policies
-- Allow users to create partnerships (they become the owner)
CREATE POLICY "Users can create partnerships" ON public.partnerships
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Allow users to view partnerships they are members of
CREATE POLICY "Users can view partnerships they belong to" ON public.partnerships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = partnerships.id
      AND partnership_members.user_id = auth.uid()
    )
    OR owner_id = auth.uid()  -- Also allow owner to see even if member record doesn't exist yet
  );

-- Allow owners to update their partnerships
CREATE POLICY "Users can update own partnerships" ON public.partnerships
  FOR UPDATE
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- Allow owners to delete their partnerships
CREATE POLICY "Users can delete own partnerships" ON public.partnerships
  FOR DELETE
  USING (owner_id = auth.uid());

-- Partnership members table policies
-- Allow users to create memberships for themselves
CREATE POLICY "Users can create memberships" ON public.partnership_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Allow users to view memberships in their partnerships
CREATE POLICY "Users can view memberships" ON public.partnership_members
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM partnership_members pm2
      WHERE pm2.partnership_id = partnership_members.partnership_id
      AND pm2.user_id = auth.uid()
    )
  );

-- Allow owners to update memberships in their partnerships
CREATE POLICY "Owners can update memberships" ON public.partnership_members
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = partnership_members.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Allow users to delete their own memberships
CREATE POLICY "Users can delete own memberships" ON public.partnership_members
  FOR DELETE
  USING (user_id = auth.uid());

-- Survey responses table policies
-- Allow users to create survey responses for their partnerships
CREATE POLICY "Users can create survey responses" ON public.survey_responses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = survey_responses.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = survey_responses.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Allow users to view survey responses for their partnerships
CREATE POLICY "Users can view survey responses" ON public.survey_responses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = survey_responses.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = survey_responses.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Allow users to update survey responses for their partnerships
CREATE POLICY "Users can update survey responses" ON public.survey_responses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = survey_responses.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = survey_responses.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Allow users to delete survey responses for their partnerships (if needed)
CREATE POLICY "Users can delete survey responses" ON public.survey_responses
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = survey_responses.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Grant necessary permissions to authenticated users
GRANT ALL ON public.partnerships TO authenticated;
GRANT ALL ON public.partnership_members TO authenticated;
GRANT ALL ON public.survey_responses TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Ensure UUID extension is enabled (needed for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify the policies are created
SELECT
  tablename,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('partnerships', 'partnership_members', 'survey_responses')
ORDER BY tablename, cmd;