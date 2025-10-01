-- Check what users exist in the database
SELECT
  id,
  email,
  created_at,
  email_confirmed_at,
  encrypted_password IS NOT NULL as has_password
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Check partnerships
SELECT
  p.id,
  p.display_name,
  p.owner_id,
  u.email as owner_email
FROM partnerships p
LEFT JOIN auth.users u ON u.id = p.owner_id
ORDER BY p.created_at DESC
LIMIT 10;

-- Check partnership members
SELECT
  pm.partnership_id,
  pm.user_id,
  u.email,
  p.display_name
FROM partnership_members pm
LEFT JOIN auth.users u ON u.id = pm.user_id
LEFT JOIN partnerships p ON p.id = pm.partnership_id
ORDER BY pm.joined_at DESC
LIMIT 10;
