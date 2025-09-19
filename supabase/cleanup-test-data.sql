-- Delete all test data for a fresh start
-- WARNING: This will delete ALL users and related data!

-- Delete all users (this cascades to profiles, partnerships, etc.)
DELETE FROM auth.users;

-- Verify cleanup
SELECT COUNT(*) as user_count FROM auth.users;
SELECT COUNT(*) as profile_count FROM profiles;
SELECT COUNT(*) as partnership_count FROM partnerships;
SELECT COUNT(*) as member_count FROM partnership_members;