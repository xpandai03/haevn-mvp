-- Fix RLS policy for partnership_photos to allow all partnership members to upload photos
-- Currently it only allows the owner, but both partners should be able to manage photos

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Owners can manage photos" ON partnership_photos;

-- Create a new policy that allows any partnership member to manage photos
CREATE POLICY "Partnership members can manage photos" ON partnership_photos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = partnership_photos.partnership_id
            AND partnership_members.user_id = auth.uid()
        )
    );

-- Also ensure the policy applies to INSERT operations with WITH CHECK
CREATE POLICY "Partnership members can insert photos" ON partnership_photos
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = partnership_photos.partnership_id
            AND partnership_members.user_id = auth.uid()
        )
    );
