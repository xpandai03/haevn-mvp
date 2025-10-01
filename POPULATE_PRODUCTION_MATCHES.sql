-- Populate production partnerships with complete test data
-- Run this in Production Supabase SQL Editor

-- Partnership 1: Sarah (single woman)
UPDATE partnerships
SET
  display_name = 'Sarah',
  age = 28,
  short_bio = 'Adventurous woman seeking meaningful connections',
  long_bio = 'I enjoy exploring the city, trying new restaurants, and meeting interesting people.',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10002',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE id = '4508620e-9e4c-4a8c-bbfa-03cf240c8392';

-- Partnership 2: Alex & Jordan (couple)
UPDATE partnerships
SET
  display_name = 'Alex & Jordan',
  age = 35,
  short_bio = 'Established couple looking for new friends',
  long_bio = 'We are a fun-loving couple who enjoy socializing and building genuine connections.',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10003',
  is_verified = TRUE,
  has_background_check = TRUE
WHERE id = 'c5ac6cad-d39b-4a20-beb0-aa40dca9e276';

-- Partnership 3: Maya (single woman)
UPDATE partnerships
SET
  display_name = 'Maya',
  age = 30,
  short_bio = 'Creative soul seeking authentic connections',
  long_bio = 'Artist and foodie who loves deep conversations and new experiences.',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10001',
  is_verified = FALSE,
  has_background_check = FALSE
WHERE id = '944aea9f-275c-4ce3-a1dd-4ca6c00f4c24';

-- Partnership 4: Chris & Sam (couple)
UPDATE partnerships
SET
  display_name = 'Chris & Sam',
  age = 31,
  short_bio = 'Young couple exploring ENM',
  long_bio = 'We are new to the lifestyle and excited to meet genuine people.',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10004',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE id = 'dc6a4b1f-b3d9-4948-87b0-9641b7f5b07e';

-- Partnership 5: Fill in the NULL one with data
UPDATE partnerships
SET
  display_name = 'Jamie',
  identity = 'single',
  seeking_targets = ARRAY['couple'],
  age = 27,
  short_bio = 'Open-minded individual looking for connections',
  long_bio = 'Exploring new relationship dynamics and meeting interesting people.',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10005',
  is_verified = FALSE,
  has_background_check = FALSE
WHERE id = '6c3961b3-1a78-4f49-95fc-f62abdb569f9';

-- Verify all partnerships now have complete data
SELECT id, display_name, identity, seeking_targets, age, city FROM partnerships ORDER BY display_name;
