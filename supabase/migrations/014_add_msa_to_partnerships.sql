-- Add MSA (Metropolitan Statistical Area) fields to partnerships table
-- This enables geographic filtering and future multi-MSA expansion

-- Add MSA-related columns
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS msa_name VARCHAR(255);
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS county VARCHAR(255);
-- Note: 'city' column already exists from migration 003_profiles.sql

-- Add zip_code column if it doesn't exist
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS zip_code VARCHAR(5);

-- Create indexes for geographic queries
CREATE INDEX IF NOT EXISTS idx_partnerships_msa_name ON partnerships(msa_name);
CREATE INDEX IF NOT EXISTS idx_partnerships_zip_code ON partnerships(zip_code);
CREATE INDEX IF NOT EXISTS idx_partnerships_county ON partnerships(county);

-- Add comment for documentation
COMMENT ON COLUMN partnerships.msa_name IS 'Metropolitan Statistical Area name (e.g., "Austin–Round Rock MSA")';
COMMENT ON COLUMN partnerships.zip_code IS 'User ZIP code from onboarding';
COMMENT ON COLUMN partnerships.county IS 'County name within MSA';
