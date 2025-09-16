-- HAEVN Profile System
-- Migration: 003_profiles.sql
-- Description: Add profile fields, photos, and privacy grants

-- Add profile state enum
CREATE TYPE profile_state AS ENUM ('draft', 'pending', 'live');

-- Add photo type enum
CREATE TYPE photo_type AS ENUM ('public', 'private');

-- Extend partnerships table with profile fields
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS short_bio TEXT CHECK (length(short_bio) <= 140);
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS long_bio TEXT CHECK (length(long_bio) <= 500);
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS orientation JSONB DEFAULT '{}';
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS structure JSONB DEFAULT '{}';
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS intentions JSONB DEFAULT '[]';
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS lifestyle_tags JSONB DEFAULT '[]';
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS discretion_summary TEXT;
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS profile_state profile_state DEFAULT 'draft';
ALTER TABLE partnerships ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]';

-- Create partnership_photos table
CREATE TABLE partnership_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    photo_type photo_type NOT NULL DEFAULT 'public',
    width INTEGER,
    height INTEGER,
    nsfw_flag BOOLEAN DEFAULT false,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(partnership_id, photo_url)
);

-- Create photo_grants table (one grant per handshake)
CREATE TABLE photo_grants (
    handshake_id UUID PRIMARY KEY REFERENCES handshakes(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create storage buckets (these would be created via Supabase dashboard in production)
-- INSERT INTO storage.buckets (id, name, public) VALUES
--     ('public-photos', 'public-photos', false),
--     ('private-photos', 'private-photos', false)
-- ON CONFLICT DO NOTHING;

-- Indexes for performance
CREATE INDEX idx_partnership_photos_partnership ON partnership_photos(partnership_id);
CREATE INDEX idx_partnership_photos_type ON partnership_photos(photo_type);
CREATE INDEX idx_partnership_photos_order ON partnership_photos(partnership_id, order_index);
CREATE INDEX idx_partnerships_profile_state ON partnerships(profile_state);
CREATE INDEX idx_partnerships_city ON partnerships(city);

-- Update trigger for photo_grants
CREATE TRIGGER update_photo_grants_updated_at
    BEFORE UPDATE ON photo_grants
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- RLS Policies

-- Enable RLS on all tables
ALTER TABLE partnership_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_grants ENABLE ROW LEVEL SECURITY;

-- Partnership photos policies
-- Public photos are readable by all authenticated users for live profiles
CREATE POLICY "Public photos visible for live profiles" ON partnership_photos
    FOR SELECT
    USING (
        photo_type = 'public'
        AND EXISTS (
            SELECT 1 FROM partnerships
            WHERE partnerships.id = partnership_photos.partnership_id
            AND partnerships.profile_state = 'live'
        )
    );

-- Private photos visible only with valid grant through handshake
CREATE POLICY "Private photos require grant" ON partnership_photos
    FOR SELECT
    USING (
        photo_type = 'private'
        AND EXISTS (
            SELECT 1 FROM handshakes h
            JOIN photo_grants pg ON pg.handshake_id = h.id
            JOIN partnership_members pm ON pm.user_id = auth.uid()
            WHERE pg.granted = true
            AND (
                (h.a_partnership = partnership_photos.partnership_id AND h.b_partnership = pm.partnership_id) OR
                (h.b_partnership = partnership_photos.partnership_id AND h.a_partnership = pm.partnership_id)
            )
        )
    );

-- Partnership owners can manage their photos
CREATE POLICY "Owners can manage photos" ON partnership_photos
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM partnerships
            WHERE partnerships.id = partnership_photos.partnership_id
            AND partnerships.owner_id = auth.uid()
        )
    );

-- Photo grants policies
-- Only handshake participants can view grants
CREATE POLICY "Handshake participants can view grants" ON photo_grants
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM handshakes h
            JOIN partnership_members pm ON pm.user_id = auth.uid()
            WHERE h.id = photo_grants.handshake_id
            AND (h.a_partnership = pm.partnership_id OR h.b_partnership = pm.partnership_id)
        )
    );

-- Only the partnership being viewed can update grants
CREATE POLICY "Partnership can manage their grants" ON photo_grants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM handshakes h
            JOIN partnerships p ON (p.id = h.a_partnership OR p.id = h.b_partnership)
            WHERE h.id = photo_grants.handshake_id
            AND p.owner_id = auth.uid()
        )
    );

-- Partnership profile policies (extend existing)
-- Public fields visible to authenticated users
CREATE POLICY "Public profile fields visible" ON partnerships
    FOR SELECT
    USING (
        profile_state = 'live'
        OR owner_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = partnerships.id
            AND partnership_members.user_id = auth.uid()
        )
    );

-- Only owners can update profiles
CREATE POLICY "Owners can update profiles" ON partnerships
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Note: In production, you'd also want to:
-- 1. Set up Storage bucket policies via Supabase dashboard
-- 2. Configure CORS for photo uploads
-- 3. Set up CDN for photo serving