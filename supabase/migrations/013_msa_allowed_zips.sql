-- Create table to store allowed ZIP codes for MSA-based access control
-- This table enables geographic restriction of signups to specific metro areas

CREATE TABLE IF NOT EXISTS msa_allowed_zips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zip_code VARCHAR(5) NOT NULL UNIQUE,
  msa_name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  county VARCHAR(255) NOT NULL,
  country VARCHAR(2) NOT NULL DEFAULT 'US',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on zip_code for fast lookups during validation
CREATE INDEX idx_msa_allowed_zips_zip_code ON msa_allowed_zips(zip_code);

-- Create index on msa_name for future multi-MSA queries
CREATE INDEX idx_msa_allowed_zips_msa_name ON msa_allowed_zips(msa_name);

-- Enable Row Level Security
ALTER TABLE msa_allowed_zips ENABLE ROW LEVEL SECURITY;

-- Allow public read access for ZIP validation (no authentication required during signup)
CREATE POLICY "Allow public read access to allowed ZIP codes"
  ON msa_allowed_zips
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service role can insert/update/delete ZIP codes
CREATE POLICY "Only service role can modify ZIP codes"
  ON msa_allowed_zips
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_msa_allowed_zips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_msa_allowed_zips_updated_at
  BEFORE UPDATE ON msa_allowed_zips
  FOR EACH ROW
  EXECUTE FUNCTION update_msa_allowed_zips_updated_at();
