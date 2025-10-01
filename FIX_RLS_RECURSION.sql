-- Fix the infinite recursion in partnership_members RLS policy

-- Option 1: Drop all existing policies and create a simple one
DROP POLICY IF EXISTS "Users can view their own partnership memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can insert their own partnership memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can update their own partnership memberships" ON partnership_members;
DROP POLICY IF EXISTS "Users can delete their own partnership memberships" ON partnership_members;

-- Create a simple policy that doesn't cause recursion
CREATE POLICY "Users can manage their partnership memberships"
ON partnership_members
FOR ALL
USING (auth.uid() = user_id);

-- Verify the policy
SELECT * FROM pg_policies WHERE tablename = 'partnership_members';
