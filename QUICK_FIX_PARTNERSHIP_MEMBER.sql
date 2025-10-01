/* Verify partnership was created */
SELECT id, display_name, owner_id FROM partnerships
WHERE owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;

/* Add to partnership_members if missing */
INSERT INTO partnership_members (partnership_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM partnerships
WHERE owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid
ON CONFLICT (partnership_id, user_id) DO NOTHING;

/* Verify it worked */
SELECT
  pm.partnership_id,
  pm.user_id,
  p.display_name,
  u.email
FROM partnership_members pm
JOIN partnerships p ON p.id = pm.partnership_id
JOIN auth.users u ON u.id = pm.user_id
WHERE pm.user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;
