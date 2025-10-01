-- Add missing matching fields to partnerships table
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS identity TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS seeking_targets TEXT[];
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS msa TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS zip_code TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS discretion_level TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS has_background_check BOOLEAN DEFAULT FALSE;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS profile_completeness INTEGER DEFAULT 0;

-- Populate test data for Raunek's partnership
UPDATE partnerships
SET
  display_name = 'Raunek & Partner',
  identity = 'couple',
  seeking_targets = ARRAY['woman', 'couple'],
  age = 32,
  state = 'NY',
  msa = 'New York-Newark-Jersey City',
  zip_code = '10001',
  short_bio = 'Open-minded couple exploring connections in NYC',
  long_bio = 'We are an established couple looking to meet like-minded people for meaningful connections and shared experiences.',
  is_verified = TRUE,
  has_background_check = FALSE
WHERE id = '89ca053e-d05f-4a4a-81f6-cea99c3bec02';
