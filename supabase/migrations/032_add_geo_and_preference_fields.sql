-- Migration: Add geographic coordinates and preference fields for P0 gates
-- Age Range gate: Q_AGE_MIN / Q_AGE_MAX stored in survey answers_json
-- Distance Cap gate: latitude/longitude on partnerships table
-- Race gate: Q_RACE_IDENTITY / Q_RACE_PREFERENCE stored in survey answers_json

-- Add geographic coordinates to partnerships table for distance gate
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Index for efficient spatial queries (simple B-tree, not PostGIS)
CREATE INDEX IF NOT EXISTS idx_partnerships_geo
  ON partnerships (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN partnerships.latitude IS 'Latitude of partnership location, populated via geocoding of zip_code/city';
COMMENT ON COLUMN partnerships.longitude IS 'Longitude of partnership location, populated via geocoding of zip_code/city';
