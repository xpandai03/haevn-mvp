-- ============================================================================
-- COMPLETE TEST ACCOUNT SETUP
-- ============================================================================
-- This creates a ready-to-use test account with matches
-- Run this in Supabase SQL Editor AFTER running MATCHING_MIGRATION.sql

-- Step 1: Create test user in auth.users
-- Email: test@haevn.app
-- Password: TestPass123!

-- First, check if user exists and delete if needed
DELETE FROM auth.users WHERE email = 'test@haevn.app';

-- Insert test user (Supabase will hash the password)
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'authenticated',
  'authenticated',
  'test@haevn.app',
  crypt('TestPass123!', gen_salt('bf')), -- This hashes the password
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Test User"}',
  NOW(),
  NOW(),
  '',
  '',
  '',
  ''
);

-- Step 2: Create profile for test user
INSERT INTO profiles (user_id, email, full_name, city, survey_complete, profile_visible)
VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'test@haevn.app',
  'Test User',
  'San Francisco',
  true,
  true
) ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      city = EXCLUDED.city;

-- Step 3: Create partnership for test user
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
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
  'Test User',
  'Just testing the matching system 🧪'
) ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      short_bio = EXCLUDED.short_bio;

-- Step 4: Add test user to their partnership
INSERT INTO partnership_members (partnership_id, user_id, role)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'owner'
) ON CONFLICT (partnership_id, user_id) DO NOTHING;

-- Step 5: Add survey responses for test user
INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '{"structure": "ENM", "intent": ["dating", "play"], "q1_age": 32}'::jsonb,
  100
) ON CONFLICT (partnership_id) DO UPDATE
  SET answers_json = EXCLUDED.answers_json,
      completion_pct = EXCLUDED.completion_pct;

-- ============================================================================
-- CREATE MATCH #1: High Match (Platinum)
-- ============================================================================
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, -- Same owner for simplicity
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
  'Fun-loving couple exploring ENM together 💕'
) ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES (
  '22222222-2222-2222-2222-222222222222'::uuid,
  '{"structure": "ENM", "intent": ["play", "dating"], "q1_age": 28}'::jsonb,
  100
) ON CONFLICT (partnership_id) DO UPDATE
  SET answers_json = EXCLUDED.answers_json;

-- ============================================================================
-- CREATE MATCH #2: Good Match (Gold)
-- ============================================================================
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'Oakland',
  'couple',
  ARRAY['couples', 'women'],
  30,
  '94607',
  'CA',
  'SF-BAY-AREA',
  'Low',
  'free',
  true,
  false,
  'Sam & Morgan',
  'Easy-going couple looking for connections 🌈'
) ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES (
  '33333333-3333-3333-3333-333333333333'::uuid,
  '{"structure": "Open", "intent": ["play", "friendship"], "q1_age": 30}'::jsonb,
  100
) ON CONFLICT (partnership_id) DO UPDATE
  SET answers_json = EXCLUDED.answers_json;

-- ============================================================================
-- CREATE MATCH #3: Medium Match (Silver)
-- ============================================================================
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
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'Berkeley',
  'single',
  ARRAY['singles', 'couples'],
  29,
  '94704',
  'CA',
  'SF-BAY-AREA',
  'High',
  'select',
  true,
  true,
  'Alex',
  'Exploring polyamory with intention and care ✨'
) ON CONFLICT (id) DO UPDATE
  SET display_name = EXCLUDED.display_name;

INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES (
  '44444444-4444-4444-4444-444444444444'::uuid,
  '{"structure": "Poly", "intent": ["dating", "long-term"], "q1_age": 29}'::jsonb,
  100
) ON CONFLICT (partnership_id) DO UPDATE
  SET answers_json = EXCLUDED.answers_json;

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to confirm everything was created

SELECT
  'Test Account Created!' as status,
  email,
  id as user_id
FROM auth.users
WHERE email = 'test@haevn.app';

SELECT
  'Partnerships Created' as status,
  COUNT(*) as partnership_count
FROM partnerships;

SELECT
  p.display_name,
  p.identity,
  p.city,
  p.seeking_targets,
  sr.answers_json->>'structure' as structure
FROM partnerships p
LEFT JOIN survey_responses sr ON sr.partnership_id = p.id
ORDER BY p.created_at DESC
LIMIT 4;

-- ============================================================================
-- LOGIN CREDENTIALS
-- ============================================================================
-- Email: test@haevn.app
-- Password: TestPass123!
-- ============================================================================
