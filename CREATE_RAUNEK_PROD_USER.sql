-- Create partnership and link to raunek@xpandai.com
-- Run this AFTER signing up with raunek@xpandai.com in production

-- Step 1: Find the user ID for raunek@xpandai.com
-- Copy the user ID from the result
SELECT id, email FROM auth.users WHERE email = 'raunek@xpandai.com';

-- Step 2: Create partnership for Raunek (replace USER_ID_HERE with actual ID from Step 1)
INSERT INTO partnerships (id, owner_id, city, display_name, identity, seeking_targets, age, state, msa, zip_code, short_bio, long_bio, is_verified, has_background_check)
VALUES (
  gen_random_uuid(),
  'USER_ID_HERE', -- Replace with actual user ID
  'San Francisco',
  'Raunek',
  'single',
  ARRAY['couple', 'single'],
  32,
  'CA',
  'San Francisco-Oakland-Berkeley',
  '94102',
  'Tech entrepreneur exploring meaningful connections',
  'Building AI products by day, exploring the Bay Area by night. Looking for authentic connections with open-minded people.',
  TRUE,
  FALSE
) RETURNING id;

-- Step 3: Link user to their partnership (replace BOTH IDs)
INSERT INTO partnership_members (partnership_id, user_id, role)
VALUES (
  'PARTNERSHIP_ID_HERE', -- From Step 2 RETURNING
  'USER_ID_HERE', -- From Step 1
  'owner'
);
