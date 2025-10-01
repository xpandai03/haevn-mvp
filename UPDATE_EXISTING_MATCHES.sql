-- Update Raunek's partnership to seek singles and couples
UPDATE partnerships
SET seeking_targets = ARRAY['single', 'couple']
WHERE id = '89ca053e-d05f-4a4a-81f6-cea99c3bec02';

-- Update the 4 existing partnerships with test data
UPDATE partnerships
SET
  display_name = 'Sarah',
  identity = 'single',
  seeking_targets = ARRAY['couple', 'single'],
  age = 28,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10002',
  short_bio = 'Adventurous woman seeking meaningful connections',
  long_bio = 'I enjoy exploring the city, trying new restaurants, and meeting interesting people.',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE id = '4508620e-9e4c-4a8c-bbfa-03cf240c8392';

UPDATE partnerships
SET
  display_name = 'Alex & Jordan',
  identity = 'couple',
  seeking_targets = ARRAY['single', 'couple'],
  age = 35,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10003',
  short_bio = 'Established couple looking for new friends',
  long_bio = 'We are a fun-loving couple who enjoy socializing and building genuine connections.',
  is_verified = TRUE,
  has_background_check = TRUE
WHERE id = 'c5ac6cad-d39b-4a20-beb0-aa40dca9e276';

UPDATE partnerships
SET
  display_name = 'Maya',
  identity = 'single',
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
WHERE id = '944aea9f-275c-4ce3-a1dd-4ca6c00f4c24';

UPDATE partnerships
SET
  display_name = 'Chris & Sam',
  identity = 'couple',
  seeking_targets = ARRAY['single'],
  age = 31,
  city = 'New York',
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10004',
  short_bio = 'Young couple exploring ENM',
  long_bio = 'We are new to the lifestyle and excited to meet genuine people.',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE id = 'dc6a4b1f-b3d9-4948-87b0-9641b7f5b07e';
