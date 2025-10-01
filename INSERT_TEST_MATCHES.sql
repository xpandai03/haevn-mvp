-- Insert test partnerships for matching
-- Using fake UUIDs for owner_id (these won't have real auth users, but that's ok for matching tests)

INSERT INTO partnerships (id, owner_id, city, display_name, identity, seeking_targets, age, state, msa, zip_code, short_bio, long_bio, is_verified, has_background_check)
VALUES
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'aaaaaaaa-0000-0000-0000-000000000001',
    'New York',
    'Sarah',
    'single',
    ARRAY['couple', 'single'],
    28,
    'NY',
    'New York-Newark-Jersey City',
    '10002',
    'Adventurous woman seeking meaningful connections',
    'I enjoy exploring the city, trying new restaurants, and meeting interesting people. Open to various relationship structures.',
    TRUE,
    FALSE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    'aaaaaaaa-0000-0000-0000-000000000002',
    'New York',
    'Alex & Jordan',
    'couple',
    ARRAY['single', 'couple'],
    35,
    'NY',
    'New York-Newark-Jersey City',
    '10003',
    'Established couple looking for new friends',
    'We are a fun-loving couple who enjoy socializing and building genuine connections with like-minded people.',
    TRUE,
    TRUE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    'aaaaaaaa-0000-0000-0000-000000000003',
    'New York',
    'Maya',
    'single',
    ARRAY['couple'],
    30,
    'NY',
    'New York-Newark-Jersey City',
    '10001',
    'Creative soul seeking authentic connections',
    'Artist and foodie who loves deep conversations and new experiences.',
    FALSE,
    FALSE
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000004',
    'aaaaaaaa-0000-0000-0000-000000000004',
    'New York',
    'Chris & Sam',
    'couple',
    ARRAY['single'],
    31,
    'NY',
    'New York-Newark-Jersey City',
    '10004',
    'Young couple exploring ENM',
    'We are new to the lifestyle and excited to meet genuine people.',
    TRUE,
    FALSE
  )
ON CONFLICT (id) DO NOTHING;
