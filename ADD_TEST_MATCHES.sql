-- Add test data for other partnerships to create matches

-- Partnership 1: Single woman in NYC
UPDATE partnerships
SET
  display_name = 'Sarah',
  identity = 'woman',
  seeking_targets = ARRAY['couple', 'man'],
  age = 28,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10002',
  short_bio = 'Adventurous woman seeking meaningful connections',
  long_bio = 'I enjoy exploring the city, trying new restaurants, and meeting interesting people. Open to various relationship structures.',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE city = 'Los Angeles' AND owner_id = '388b80d6-2fe8-448d-a72d-e6a5784519a1'
LIMIT 1;

-- Partnership 2: Couple in NYC
UPDATE partnerships
SET
  display_name = 'Alex & Jordan',
  identity = 'couple',
  seeking_targets = ARRAY['woman', 'couple'],
  age = 35,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10003',
  short_bio = 'Established couple looking for new friends and connections',
  long_bio = 'We are a fun-loving couple who enjoy socializing and building genuine connections with like-minded people.',
  is_verified = TRUE,
  has_background_check = TRUE
WHERE city = 'Los Angeles' AND owner_id = 'd44133e4-6fdc-413b-a78c-1e4981ba0026'
LIMIT 1;

-- Partnership 3: Single woman in NYC
UPDATE partnerships
SET
  display_name = 'Maya',
  identity = 'woman',
  seeking_targets = ARRAY['couple'],
  age = 30,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10001',
  short_bio = 'Creative soul seeking authentic connections',
  long_bio = 'Artist and foodie who loves deep conversations and new experiences.',
  is_verified = FALSE,
  has_background_check = FALSE
WHERE city = 'New York' AND owner_id = 'f4cb13a5-747a-4e72-994d-874840f92071'
LIMIT 1;

-- Partnership 4: Couple in NYC
UPDATE partnerships
SET
  display_name = 'Chris & Sam',
  identity = 'couple',
  seeking_targets = ARRAY['woman'],
  age = 31,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10004',
  short_bio = 'Young couple exploring ENM',
  long_bio = 'We are new to the lifestyle and excited to meet genuine people.',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE city = 'New York' AND owner_id = '1278d0f0-a387-4b02-b3f3-f64102add15f'
LIMIT 1;
