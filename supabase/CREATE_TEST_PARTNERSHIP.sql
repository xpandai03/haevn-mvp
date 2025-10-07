-- Create test partnership for raunek@tester.com
-- User ID: f5cd575f-5835-458b-82c5-32d9c26ad815

INSERT INTO partnerships (id, owner_id, city, membership_tier, display_name)
VALUES (
  'c1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6'::uuid,
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  'New York',
  'free',
  'Raunek & Partner'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO partnership_members (partnership_id, user_id, role)
VALUES (
  'c1a2b3c4-d5e6-f7g8-h9i0-j1k2l3m4n5o6'::uuid,
  'f5cd575f-5835-458b-82c5-32d9c26ad815'::uuid,
  'owner'
)
ON CONFLICT (partnership_id, user_id) DO NOTHING;
