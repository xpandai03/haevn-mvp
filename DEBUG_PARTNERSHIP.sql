/* Check if partnership_members has your data */
SELECT * FROM partnership_members
WHERE user_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;

/* Check if partnerships has the matching fields */
SELECT
  id,
  display_name,
  identity,
  seeking_targets,
  city,
  age
FROM partnerships
WHERE owner_id = 'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid;

/* Check other partnerships for matches */
SELECT
  id,
  display_name,
  identity,
  seeking_targets,
  city
FROM partnerships
WHERE id IN (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid,
  '33333333-3333-3333-3333-333333333333'::uuid,
  '44444444-4444-4444-4444-444444444444'::uuid
);
