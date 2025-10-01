-- PRODUCTION SETUP - Run this in Production Supabase SQL Editor
-- This sets up the matching system in production

-- Step 1: Add matching fields (if not already added)
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

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_partnerships_identity ON partnerships(identity);
CREATE INDEX IF NOT EXISTS idx_partnerships_seeking_targets ON partnerships USING GIN(seeking_targets);
CREATE INDEX IF NOT EXISTS idx_partnerships_age ON partnerships(age);
CREATE INDEX IF NOT EXISTS idx_partnerships_msa ON partnerships(msa);
CREATE INDEX IF NOT EXISTS idx_partnerships_is_verified ON partnerships(is_verified);

-- Step 3: Check existing partnerships
SELECT id, owner_id, city, identity, seeking_targets FROM partnerships LIMIT 5;
