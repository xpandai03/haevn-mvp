-- First, check if there are any existing users
SELECT * FROM auth.users;

-- Check if profiles table exists and has data
SELECT * FROM public.profiles;

-- Delete any test users (be careful with this in production!)
-- Uncomment the lines below if you want to clean up test data:
-- DELETE FROM auth.users WHERE email LIKE 'test%' OR email = 'raunek.pratap7@gmail.com';

-- Recreate the trigger with better error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only insert if profile doesn't already exist
  INSERT INTO public.profiles (user_id, full_name, zip_code, city)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'zip_code',
    NEW.raw_user_meta_data->>'city'
  )
  ON CONFLICT (user_id) DO NOTHING;  -- Don't fail if profile already exists

  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the signup
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();