-- Additional fix specifically for identity update
-- This ensures the updateIdentityFields action works

-- First, let's verify the current user has a partnership
SELECT
  u.id as user_id,
  u.email,
  p.id as partnership_id,
  p.owner_id,
  p.profile_type,
  p.relationship_orientation
FROM auth.users u
LEFT JOIN partnerships p ON p.owner_id = u.id
ORDER BY u.created_at DESC
LIMIT 1;

-- Create a more direct update function
CREATE OR REPLACE FUNCTION update_identity_fields(
  p_user_id UUID,
  p_profile_type profile_type,
  p_orientation TEXT[]
) RETURNS BOOLEAN AS $$
DECLARE
  v_partnership_id UUID;
BEGIN
  -- Get the user's partnership
  SELECT id INTO v_partnership_id
  FROM partnerships
  WHERE owner_id = p_user_id
  LIMIT 1;

  -- If no partnership exists, create one
  IF v_partnership_id IS NULL THEN
    INSERT INTO partnerships (owner_id, city, membership_tier, profile_type, relationship_orientation)
    VALUES (p_user_id, 'New York', 'free', p_profile_type, p_orientation)
    RETURNING id INTO v_partnership_id;
  ELSE
    -- Update the existing partnership
    UPDATE partnerships
    SET
      profile_type = p_profile_type,
      relationship_orientation = p_orientation,
      updated_at = NOW()
    WHERE id = v_partnership_id;
  END IF;

  -- Update/create onboarding state
  INSERT INTO onboarding_state (user_id, partnership_id, identity_completed, current_step, completed_steps)
  VALUES (p_user_id, v_partnership_id, true, 5, '["signup", "expectations", "welcome", "identity"]'::jsonb)
  ON CONFLICT (user_id) DO UPDATE
  SET
    identity_completed = true,
    current_step = GREATEST(onboarding_state.current_step, 5),
    completed_steps = onboarding_state.completed_steps || '["identity"]'::jsonb;

  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in update_identity_fields: %', SQLERRM;
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION update_identity_fields TO authenticated;

-- Test it with the latest user
DO $$
DECLARE
  test_user_id UUID;
  success BOOLEAN;
BEGIN
  SELECT id INTO test_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;

  success := update_identity_fields(
    test_user_id,
    'solo'::profile_type,
    ARRAY['Open / ENM']::TEXT[]
  );

  IF success THEN
    RAISE NOTICE 'Successfully updated identity for user %', test_user_id;
  ELSE
    RAISE WARNING 'Failed to update identity for user %', test_user_id;
  END IF;
END $$;