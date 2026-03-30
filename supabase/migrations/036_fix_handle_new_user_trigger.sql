-- Migration 036: Fix handle_new_user trigger
--
-- ROOT CAUSE: The trigger referenced a non-existent 'zip_code' column on profiles,
-- causing silent failures when creating new auth users. This meant new signups
-- got auth.users rows but NO profiles row, making them invisible to the app.
--
-- FIX: Remove zip_code reference, add ON CONFLICT safety, backfill missing profiles.

-- 1. Fix the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Ensure the trigger exists (recreate if missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: create profiles for any auth.users that are missing one
INSERT INTO profiles (user_id, full_name)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', '')
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM profiles)
ON CONFLICT (user_id) DO NOTHING;
