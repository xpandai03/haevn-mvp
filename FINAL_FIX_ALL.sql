/* FINAL FIX - Run this and refresh dashboard */

/* Delete any conflicting data first */
DELETE FROM partnership_members WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
DELETE FROM partnerships WHERE owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
DELETE FROM survey_responses WHERE partnership_id IN (
  SELECT id FROM partnerships WHERE owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
);

/* Create your main partnership */
INSERT INTO partnerships (id, owner_id, city, identity, seeking_targets, age, zip_code, state, msa, discretion_level, membership_tier, is_verified, has_background_check, display_name, short_bio)
VALUES (
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid,
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  'San Francisco', 'single', ARRAY['couples', 'women'], 32, '94102', 'CA', 'SF-BAY-AREA', 'Medium', 'standard', true, false, 'Raunek', 'Testing matches'
);

/* Add to partnership_members */
INSERT INTO partnership_members (partnership_id, user_id, role)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid, 'owner');

/* Add survey */
INSERT INTO survey_responses (partnership_id, answers_json, completion_pct)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'::uuid, '{"structure": "ENM", "intent": ["dating", "play"]}'::jsonb, 100);

/* Verify - should return 1 row */
SELECT 'SUCCESS - Partnership linked!' as status, pm.partnership_id, p.display_name
FROM partnership_members pm
JOIN partnerships p ON p.id = pm.partnership_id
WHERE pm.user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
