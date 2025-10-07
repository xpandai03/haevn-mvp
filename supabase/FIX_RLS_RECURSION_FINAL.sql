-- Fix RLS Recursion Issue for partnership_members and partnership_photos
-- The problem: partnership_photos policies check partnership_members,
-- and partnership_members policies check partnerships, causing infinite recursion

-- ============================================
-- STEP 1: Fix partnership_members policies (remove recursion)
-- ============================================

-- Drop all existing partnership_members policies
DROP POLICY IF EXISTS "Users can view partnership memberships" ON partnership_members;
DROP POLICY IF EXISTS "Partnership owners can manage members" ON partnership_members;
DROP POLICY IF EXISTS "Users can manage their partnership memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can create memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can view memberships" ON partnership_members;
DROP POLICY IF EXISTS "Owners can update memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can delete own memberships" ON partnership_members;
DROP POLICY IF EXISTS "members_select" ON partnership_members;
DROP POLICY IF EXISTS "members_insert" ON partnership_members;
DROP POLICY IF EXISTS "members_update" ON partnership_members;

-- Create simple, non-recursive policies for partnership_members
-- These policies ONLY check auth.uid(), not other tables

CREATE POLICY "partnership_members_select_simple" ON partnership_members
  FOR SELECT
  USING (true);  -- Allow reading all memberships (needed for joins)

CREATE POLICY "partnership_members_insert_simple" ON partnership_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());  -- Users can only insert themselves

CREATE POLICY "partnership_members_update_simple" ON partnership_members
  FOR UPDATE
  USING (user_id = auth.uid());  -- Users can only update their own memberships

CREATE POLICY "partnership_members_delete_simple" ON partnership_members
  FOR DELETE
  USING (user_id = auth.uid());  -- Users can only delete their own memberships

-- ============================================
-- STEP 2: Fix partnership_photos policies (already correct)
-- ============================================

-- The partnership_photos policies are fine - they check partnership_members
-- which now has simple policies that won't cause recursion

-- Verify current policies
DROP POLICY IF EXISTS "Partnership members can manage photos" ON partnership_photos;
DROP POLICY IF EXISTS "Partnership members can insert photos" ON partnership_photos;
DROP POLICY IF EXISTS "Owners can manage photos" ON partnership_photos;
DROP POLICY IF EXISTS "Public photos visible for live profiles" ON partnership_photos;
DROP POLICY IF EXISTS "Private photos require grant" ON partnership_photos;

-- Create new simple policy for partnership_photos
CREATE POLICY "partnership_photos_all_simple" ON partnership_photos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = partnership_photos.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = partnership_photos.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
  );

-- ============================================
-- STEP 3: Verify the fix
-- ============================================

-- Check partnership_members policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'partnership_members'
ORDER BY policyname;

-- Check partnership_photos policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'partnership_photos'
ORDER BY policyname;
