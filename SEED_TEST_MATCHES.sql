-- ============================================================================
-- HAEVN Test Data Seeding
-- ============================================================================
-- Creates 4 test partnerships for testing the matching system
-- Run this AFTER running MATCHING_MIGRATION.sql

-- NOTE: You'll need to replace these UUIDs with actual user IDs from your auth.users table
-- For now, we'll use placeholder UUIDs

-- Test Partnership 1: Single person seeking couples (ENM)
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
  '11111111-1111-1111-1111-111111111111'::uuid,
  (SELECT id FROM auth.users LIMIT 1), -- Replace with actual user ID
  'San Francisco',
  'single',
  ARRAY['couples', 'women'],
  32,
  '94102',
  'CA',
  'SF-BAY-AREA',
  'Medium',
  'free',
  true,
  false,
  'Alex',
  'Open-minded explorer seeking genuine connections in the Bay Area 🌉'
) ON CONFLICT (id) DO NOTHING;

-- Test Partnership 2: Couple seeking singles/couples (ENM)
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
  '22222222-2222-2222-2222-222222222222'::uuid,
  (SELECT id FROM auth.users LIMIT 1 OFFSET 1), -- Replace with actual user ID
  'San Francisco',
  'couple',
  ARRAY['singles', 'couples'],
  28,
  '94110',
  'CA',
  'SF-BAY-AREA',
  'Medium',
  'standard',
  true,
  false,
  'Jamie & Taylor',
  'Fun-loving couple exploring ethical non-monogamy together 💕'
) ON CONFLICT (id) DO NOTHING;

-- Test Partnership 3: Couple seeking couples (Open)
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
  '33333333-3333-3333-3333-333333333333'::uuid,
  (SELECT id FROM auth.users LIMIT 1 OFFSET 2), -- Replace with actual user ID
  'Oakland',
  'couple',
  ARRAY['couples'],
  30,
  '94607',
  'CA',
  'SF-BAY-AREA',
  'Low',
  'free',
  true,
  false,
  'Sam & Morgan',
  'Easy-going couple looking for like-minded friends and more 🌈'
) ON CONFLICT (id) DO NOTHING;

-- Test Partnership 4: Single seeking singles (Monogamous) - Different location
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
  '44444444-4444-4444-4444-444444444444'::uuid,
  (SELECT id FROM auth.users LIMIT 1 OFFSET 3), -- Replace with actual user ID
  'Los Angeles',
  'single',
  ARRAY['singles'],
  35,
  '90001',
  'CA',
  'LA-METRO',
  'High',
  'select',
  true,
  true,
  'Casey',
  'Traditional values, seeking meaningful long-term connection 🌹'
) ON CONFLICT (id) DO NOTHING;

-- Add intent/structure to survey_responses for these partnerships
INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid,
   '{"structure": "ENM", "intent": ["dating", "play"], "q1_age": 32}'::jsonb,
   100),
  ('22222222-2222-2222-2222-222222222222'::uuid,
   '{"structure": "ENM", "intent": ["play"], "q1_age": 28}'::jsonb,
   100),
  ('33333333-3333-3333-3333-333333333333'::uuid,
   '{"structure": "Open", "intent": ["play", "friendship"], "q1_age": 30}'::jsonb,
   100),
  ('44444444-4444-4444-4444-444444444444'::uuid,
   '{"structure": "Monogamous", "intent": ["dating", "long-term"], "q1_age": 35}'::jsonb,
   100)
ON CONFLICT (partnership_id) DO UPDATE
  SET answers_json = EXCLUDED.answers_json,
      completion_pct = EXCLUDED.completion_pct;

-- Verify the data
SELECT
  id,
  display_name,
  identity,
  seeking_targets,
  city,
  msa,
  discretion_level
FROM partnerships
WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);
