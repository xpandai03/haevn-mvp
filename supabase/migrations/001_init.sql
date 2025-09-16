-- HAEVN Database Schema
-- Migration: 001_init.sql
-- Description: Initial database setup with all core tables

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
CREATE TYPE msa_status AS ENUM ('live', 'waitlist');
CREATE TYPE membership_tier AS ENUM ('free', 'plus', 'select');
CREATE TYPE partnership_role AS ENUM ('owner', 'member');
CREATE TYPE subscription_plan AS ENUM ('free', 'plus', 'select');
CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'canceled', 'past_due');

-- profiles table - extends auth.users
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    city TEXT,
    msa_status msa_status DEFAULT 'waitlist',
    survey_complete BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- partnerships table - group profiles for couples/throuples
CREATE TABLE partnerships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    city TEXT,
    membership_tier membership_tier DEFAULT 'free',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- partnership_members table - many-to-many relationship
CREATE TABLE partnership_members (
    partnership_id UUID REFERENCES partnerships(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role partnership_role DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (partnership_id, user_id)
);

-- survey_responses table - one per partnership
CREATE TABLE survey_responses (
    partnership_id UUID PRIMARY KEY REFERENCES partnerships(id) ON DELETE CASCADE,
    answers_json JSONB DEFAULT '{}',
    completion_pct INTEGER DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- city_status table - track which cities are live
CREATE TABLE city_status (
    city TEXT PRIMARY KEY,
    is_live BOOLEAN DEFAULT false
);

-- signals table - one-way likes/interest
CREATE TABLE signals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_partnership UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    to_partnership UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(from_partnership, to_partnership),
    CHECK (from_partnership != to_partnership)
);

-- handshakes table - mutual matches
CREATE TABLE handshakes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    a_partnership UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    b_partnership UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(a_partnership, b_partnership),
    CHECK (a_partnership < b_partnership) -- Ensures consistent ordering
);

-- messages table - chat messages between matched partnerships
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    handshake_id UUID NOT NULL REFERENCES handshakes(id) ON DELETE CASCADE,
    sender_user UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (length(body) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- subscriptions table - user billing/subscription info
CREATE TABLE subscriptions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    plan subscription_plan DEFAULT 'free',
    status subscription_status DEFAULT 'active',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_partnerships_owner ON partnerships(owner_id);
CREATE INDEX idx_partnership_members_user ON partnership_members(user_id);
CREATE INDEX idx_partnership_members_partnership ON partnership_members(partnership_id);
CREATE INDEX idx_signals_from ON signals(from_partnership);
CREATE INDEX idx_signals_to ON signals(to_partnership);
CREATE INDEX idx_handshakes_partnerships ON handshakes(a_partnership, b_partnership);
CREATE INDEX idx_messages_handshake ON messages(handshake_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Triggers to update timestamp fields
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_survey_responses_updated_at
    BEFORE UPDATE ON survey_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Insert some initial city data
INSERT INTO city_status (city, is_live) VALUES
    ('New York', true),
    ('Los Angeles', true),
    ('San Francisco', true),
    ('Chicago', false),
    ('Austin', false),
    ('Miami', false),
    ('Seattle', false),
    ('Boston', false)
ON CONFLICT (city) DO NOTHING;