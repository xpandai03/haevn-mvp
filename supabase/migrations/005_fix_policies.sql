-- Fix infinite recursion in RLS policies
-- Migration: 005_fix_policies.sql
-- Description: Fixes circular dependency between partnerships and partnership_members policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "partnerships_select_members" ON partnerships;
DROP POLICY IF EXISTS "partnership_members_select" ON partnership_members;

-- Recreate partnerships SELECT policy without circular reference
CREATE POLICY "partnerships_select_members" ON partnerships
    FOR SELECT
    USING (
        -- User is the owner
        owner_id = auth.uid()
        OR
        -- User is a member (direct check without subquery to partnerships)
        id IN (
            SELECT partnership_id
            FROM partnership_members
            WHERE user_id = auth.uid()
        )
    );

-- Recreate partnership_members SELECT policy without circular reference
CREATE POLICY "partnership_members_select" ON partnership_members
    FOR SELECT
    USING (
        -- User can see their own membership
        user_id = auth.uid()
        OR
        -- User can see all members of partnerships they belong to
        partnership_id IN (
            SELECT partnership_id
            FROM partnership_members pm2
            WHERE pm2.user_id = auth.uid()
        )
    );