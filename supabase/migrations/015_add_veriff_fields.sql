-- Add Veriff verification fields to profiles table
-- Migration: 015_add_veriff_fields.sql

-- Add columns for Veriff integration
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS veriff_session_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_date TIMESTAMPTZ;

-- Add index for session ID lookups
CREATE INDEX IF NOT EXISTS idx_profiles_veriff_session ON profiles(veriff_session_id);

-- Add index for verification status queries
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);

-- Add comments for documentation
COMMENT ON COLUMN profiles.veriff_session_id IS 'Veriff session ID for tracking verification attempts';
COMMENT ON COLUMN profiles.verification_status IS 'Verification status: pending, approved, declined, or null';
COMMENT ON COLUMN profiles.verification_date IS 'Timestamp when verification was completed (approved or declined)';
