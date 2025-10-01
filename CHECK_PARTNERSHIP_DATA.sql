-- Check the partnership data for the user's partnership
SELECT
  id,
  display_name,
  identity,
  seeking_targets,
  age,
  city,
  discretion_level,
  is_verified,
  has_background_check,
  profile_completeness
FROM partnerships
WHERE id = '89ca053e-d05f-4a4a-81f6-cea99c3bec02';

-- Check ALL partnerships to see what data exists
SELECT
  id,
  display_name,
  identity,
  seeking_targets,
  age,
  city
FROM partnerships
LIMIT 10;
