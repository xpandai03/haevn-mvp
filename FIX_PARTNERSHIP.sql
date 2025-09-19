-- Fix partnership creation issues
-- Ensure profile exists and can create partnerships

-- First, let's check if there are any profiles without partnerships
SELECT p.*, pm.partnership_id
FROM profiles p
LEFT JOIN partnership_members pm ON p.user_id = pm.user_id
WHERE pm.partnership_id IS NULL;

-- Create a function to ensure profile and partnership exist
CREATE OR REPLACE FUNCTION ensure_user_setup(p_user_id UUID)
RETURNS TABLE(profile_id UUID, partnership_id UUID) AS $$
DECLARE
  v_profile_id UUID;
  v_partnership_id UUID;
  v_user_email TEXT;
  v_user_city TEXT;
BEGIN
  -- Get user email
  SELECT email INTO v_user_email FROM auth.users WHERE id = p_user_id;

  -- Ensure profile exists
  INSERT INTO profiles (user_id, email, full_name, city, msa_status)
  VALUES (
    p_user_id,
    v_user_email,
    COALESCE((SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id), 'User'),
    COALESCE((SELECT raw_user_meta_data->>'city' FROM auth.users WHERE id = p_user_id), 'New York'),
    COALESCE((SELECT raw_user_meta_data->>'msa_status' FROM auth.users WHERE id = p_user_id), 'live')
  )
  ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email
  RETURNING user_id INTO v_profile_id;

  -- Check if user already has a partnership
  SELECT pm.partnership_id INTO v_partnership_id
  FROM partnership_members pm
  WHERE pm.user_id = p_user_id
  LIMIT 1;

  -- If no partnership, create one
  IF v_partnership_id IS NULL THEN
    -- Get city from profile
    SELECT city INTO v_user_city FROM profiles WHERE user_id = p_user_id;

    -- Create partnership
    INSERT INTO partnerships (owner_id, city, membership_tier, advocate_mode)
    VALUES (p_user_id, COALESCE(v_user_city, 'New York'), 'free', false)
    RETURNING id INTO v_partnership_id;

    -- Add user as member
    INSERT INTO partnership_members (partnership_id, user_id, role)
    VALUES (v_partnership_id, p_user_id, 'owner');

    -- Create onboarding state
    INSERT INTO onboarding_state (user_id, partnership_id, current_step, completed_steps)
    VALUES (p_user_id, v_partnership_id, 2, '["signup"]'::jsonb)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN QUERY SELECT v_profile_id, v_partnership_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION ensure_user_setup TO authenticated;

-- Fix any existing users who signed up but don't have partnerships
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT u.id as user_id
    FROM auth.users u
    LEFT JOIN partnership_members pm ON u.id = pm.user_id
    WHERE pm.user_id IS NULL
  LOOP
    PERFORM ensure_user_setup(r.user_id);
  END LOOP;
END $$;