/* Create Partnership for raunek@tester.com */

/* Create partnership for Raunek */
INSERT INTO partnerships (
  id,
  owner_id,
  city,
  identity,
  seeking_targets,
  age,
  zip_code,
  state,
  msa,
  discretion_level,
  membership_tier,
  is_verified,
  has_background_check,
  display_name,
  short_bio
) VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  'San Francisco',
  'single',
  ARRAY['couples', 'women'],
  32,
  '94102',
  'CA',
  'SF-BAY-AREA',
  'Medium',
  'standard',
  true,
  false,
  'Raunek',
  'Testing the matching system 🚀'
) ON CONFLICT (id) DO UPDATE
  SET owner_id = EXCLUDED.owner_id,
      display_name = EXCLUDED.display_name;

/* Add to partnership_members */
INSERT INTO partnership_members (partnership_id, user_id, role)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  'owner'
) ON CONFLICT (partnership_id, user_id) DO NOTHING;

/* Add survey data */
INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES (
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,
  '{"structure": "ENM", "intent": ["dating", "play"], "q1_age": 32}'::jsonb,
  100
) ON CONFLICT (partnership_id) DO UPDATE
  SET answers_json = EXCLUDED.answers_json;

/* Verify */
SELECT
  p.display_name,
  p.identity,
  u.email
FROM partnerships p
JOIN auth.users u ON u.id = p.owner_id
WHERE p.owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
