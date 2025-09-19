-- HAEVN Complete Database Setup Script
-- Run this entire script in your new Supabase SQL Editor

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PART 1: Core Tables (from 001_init.sql)
-- ============================================

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  city TEXT,
  msa_status TEXT CHECK (msa_status IN ('live', 'waitlist')),
  survey_complete BOOLEAN DEFAULT false,
  profile_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partnerships table
CREATE TABLE IF NOT EXISTS partnerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  city TEXT NOT NULL,
  membership_tier TEXT DEFAULT 'free' CHECK (membership_tier IN ('free', 'standard', 'select')),
  advocate_mode BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partnership members
CREATE TABLE IF NOT EXISTS partnership_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partnership_id, user_id)
);

-- Handshakes (connections between partnerships)
CREATE TABLE IF NOT EXISTS handshakes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  a_partnership UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  b_partnership UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  a_consent BOOLEAN DEFAULT false,
  b_consent BOOLEAN DEFAULT false,
  match_score INTEGER,
  state TEXT DEFAULT 'viewed' CHECK (state IN ('viewed', 'matched', 'dismissed')),
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  UNIQUE(a_partnership, b_partnership),
  CHECK (a_partnership < b_partnership)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  handshake_id UUID NOT NULL REFERENCES handshakes(id) ON DELETE CASCADE,
  sender_partnership UUID NOT NULL REFERENCES partnerships(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message reads tracking
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- ============================================
-- PART 2: Profile & Photo System (from 003_profiles.sql)
-- ============================================

-- Create enums
CREATE TYPE IF NOT EXISTS profile_state AS ENUM ('draft', 'pending', 'live');
CREATE TYPE IF NOT EXISTS photo_type AS ENUM ('public', 'private');

-- Extend partnerships with profile fields
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS short_bio TEXT CHECK (length(short_bio) <= 140),
  ADD COLUMN IF NOT EXISTS long_bio TEXT CHECK (length(long_bio) <= 500),
  ADD COLUMN IF NOT EXISTS orientation JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS structure JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS intentions JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS lifestyle_tags JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS discretion_summary TEXT,
  ADD COLUMN IF NOT EXISTS profile_state profile_state DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]';

-- Partnership photos table
CREATE TABLE IF NOT EXISTS partnership_photos (
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

-- Photo grants table
CREATE TABLE IF NOT EXISTS photo_grants (
  handshake_id UUID PRIMARY KEY REFERENCES handshakes(id) ON DELETE CASCADE,
  granted BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PART 3: Survey System (from 004_onboarding_survey.sql)
-- ============================================

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  answers_json JSONB NOT NULL DEFAULT '{}',
  completion_pct INTEGER DEFAULT 0 CHECK (completion_pct >= 0 AND completion_pct <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(partnership_id)
);

-- ============================================
-- PART 4: New Onboarding Flow (from 006_onboarding_flow_fixes.sql)
-- ============================================

-- Create enums for new flow
CREATE TYPE IF NOT EXISTS profile_type AS ENUM ('solo', 'couple', 'pod');
CREATE TYPE IF NOT EXISTS verification_status AS ENUM ('none', 'pending', 'verified');

-- Add onboarding fields to partnerships
ALTER TABLE partnerships
  ADD COLUMN IF NOT EXISTS profile_type profile_type DEFAULT 'solo',
  ADD COLUMN IF NOT EXISTS relationship_orientation TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS verification_status verification_status DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Create onboarding_state table
CREATE TABLE IF NOT EXISTS onboarding_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1,
  completed_steps JSONB DEFAULT '[]',
  last_active TIMESTAMPTZ DEFAULT NOW(),
  expectations_viewed BOOLEAN DEFAULT false,
  welcome_viewed BOOLEAN DEFAULT false,
  identity_completed BOOLEAN DEFAULT false,
  verification_skipped BOOLEAN DEFAULT false,
  survey_intro_viewed BOOLEAN DEFAULT false,
  survey_completed BOOLEAN DEFAULT false,
  celebration_viewed BOOLEAN DEFAULT false,
  membership_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id),
  UNIQUE(partnership_id)
);

-- ============================================
-- PART 5: Indexes for Performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_city ON profiles(city);
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_owner ON partnerships(owner_id);
CREATE INDEX IF NOT EXISTS idx_partnerships_city ON partnerships(city);
CREATE INDEX IF NOT EXISTS idx_partnerships_profile_state ON partnerships(profile_state);
CREATE INDEX IF NOT EXISTS idx_partnerships_profile_type ON partnerships(profile_type);
CREATE INDEX IF NOT EXISTS idx_partnerships_verification_status ON partnerships(verification_status);
CREATE INDEX IF NOT EXISTS idx_partnerships_onboarding_step ON partnerships(onboarding_step);
CREATE INDEX IF NOT EXISTS idx_partnership_members_user ON partnership_members(user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_members_partnership ON partnership_members(partnership_id);
CREATE INDEX IF NOT EXISTS idx_handshakes_partnerships ON handshakes(a_partnership, b_partnership);
CREATE INDEX IF NOT EXISTS idx_handshakes_state ON handshakes(state);
CREATE INDEX IF NOT EXISTS idx_messages_handshake ON messages(handshake_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_partnership_photos_partnership ON partnership_photos(partnership_id);
CREATE INDEX IF NOT EXISTS idx_partnership_photos_type ON partnership_photos(photo_type);
CREATE INDEX IF NOT EXISTS idx_partnership_photos_order ON partnership_photos(partnership_id, order_index);
CREATE INDEX IF NOT EXISTS idx_survey_responses_partnership ON survey_responses(partnership_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_user ON onboarding_state(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_state_partnership ON onboarding_state(partnership_id);

-- ============================================
-- PART 6: Update Functions and Triggers
-- ============================================

-- Updated timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profile update trigger
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (user_id, email, full_name, city, msa_status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'city', 'New York'),
    COALESCE(NEW.raw_user_meta_data->>'msa_status', 'live')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Onboarding state update function
CREATE OR REPLACE FUNCTION update_onboarding_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.last_active = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get or create onboarding state
CREATE OR REPLACE FUNCTION get_or_create_onboarding_state(p_user_id UUID, p_partnership_id UUID)
RETURNS UUID AS $$
DECLARE
  v_state_id UUID;
BEGIN
  SELECT id INTO v_state_id
  FROM onboarding_state
  WHERE partnership_id = p_partnership_id;

  IF v_state_id IS NULL THEN
    INSERT INTO onboarding_state (user_id, partnership_id)
    VALUES (p_user_id, p_partnership_id)
    RETURNING id INTO v_state_id;
  END IF;

  RETURN v_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark onboarding step complete
CREATE OR REPLACE FUNCTION mark_onboarding_step_complete(
  p_partnership_id UUID,
  p_step_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_current_steps JSONB;
  v_new_step INTEGER;
  v_result JSONB;
BEGIN
  SELECT completed_steps INTO v_current_steps
  FROM onboarding_state
  WHERE partnership_id = p_partnership_id;

  IF v_current_steps IS NULL THEN
    v_current_steps := '[]'::jsonb;
  END IF;

  IF NOT v_current_steps ? p_step_name THEN
    v_current_steps := v_current_steps || to_jsonb(p_step_name);
  END IF;

  v_new_step := CASE p_step_name
    WHEN 'signup' THEN 2
    WHEN 'expectations' THEN 3
    WHEN 'welcome' THEN 4
    WHEN 'identity' THEN 5
    WHEN 'verification' THEN 6
    WHEN 'survey-intro' THEN 7
    WHEN 'survey' THEN 8
    WHEN 'celebration' THEN 9
    WHEN 'membership' THEN 10
    ELSE current_step
  END FROM onboarding_state WHERE partnership_id = p_partnership_id;

  UPDATE onboarding_state
  SET
    completed_steps = v_current_steps,
    current_step = GREATEST(current_step, v_new_step),
    expectations_viewed = CASE WHEN p_step_name = 'expectations' THEN true ELSE expectations_viewed END,
    welcome_viewed = CASE WHEN p_step_name = 'welcome' THEN true ELSE welcome_viewed END,
    identity_completed = CASE WHEN p_step_name = 'identity' THEN true ELSE identity_completed END,
    verification_skipped = CASE WHEN p_step_name = 'verification' THEN true ELSE verification_skipped END,
    survey_intro_viewed = CASE WHEN p_step_name = 'survey-intro' THEN true ELSE survey_intro_viewed END,
    survey_completed = CASE WHEN p_step_name = 'survey' THEN true ELSE survey_completed END,
    celebration_viewed = CASE WHEN p_step_name = 'celebration' THEN true ELSE celebration_viewed END,
    membership_selected = CASE WHEN p_step_name = 'membership' THEN true ELSE membership_selected END
  WHERE partnership_id = p_partnership_id
  RETURNING jsonb_build_object(
    'current_step', current_step,
    'completed_steps', completed_steps
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_partnerships_updated_at
  BEFORE UPDATE ON partnerships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_survey_responses_updated_at
  BEFORE UPDATE ON survey_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_photo_grants_updated_at
  BEFORE UPDATE ON photo_grants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_onboarding_state_timestamp
  BEFORE UPDATE ON onboarding_state
  FOR EACH ROW
  EXECUTE FUNCTION update_onboarding_state_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- PART 7: Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE handshakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_state ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Partnerships policies
CREATE POLICY "Users can view partnerships they belong to" ON partnerships
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = partnerships.id
      AND partnership_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their partnerships" ON partnerships
  FOR UPDATE USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can create partnerships" ON partnerships
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Partnership members policies
CREATE POLICY "Users can view partnership memberships" ON partnership_members
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = partnership_members.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

CREATE POLICY "Partnership owners can manage members" ON partnership_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = partnership_members.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Handshakes policies
CREATE POLICY "Users can view their handshakes" ON handshakes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.user_id = auth.uid()
      AND (partnership_members.partnership_id = handshakes.a_partnership
        OR partnership_members.partnership_id = handshakes.b_partnership)
    )
  );

CREATE POLICY "Users can update their handshakes" ON handshakes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.user_id = auth.uid()
      AND (partnership_members.partnership_id = handshakes.a_partnership
        OR partnership_members.partnership_id = handshakes.b_partnership)
    )
  );

-- Messages policies
CREATE POLICY "Users can view messages in their handshakes" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM handshakes h
      JOIN partnership_members pm ON pm.user_id = auth.uid()
      WHERE h.id = messages.handshake_id
      AND (h.a_partnership = pm.partnership_id OR h.b_partnership = pm.partnership_id)
    )
  );

CREATE POLICY "Users can send messages in their handshakes" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM handshakes h
      JOIN partnership_members pm ON pm.user_id = auth.uid()
      WHERE h.id = handshake_id
      AND pm.partnership_id = sender_partnership
      AND (h.a_partnership = pm.partnership_id OR h.b_partnership = pm.partnership_id)
    )
  );

-- Survey responses policies
CREATE POLICY "Partnership members can view their survey" ON survey_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = survey_responses.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Partnership members can update their survey" ON survey_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = survey_responses.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Partnership members can insert survey" ON survey_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = partnership_id
      AND partnership_members.user_id = auth.uid()
    )
  );

-- Onboarding state policies
CREATE POLICY "Partnership members can view onboarding state" ON onboarding_state
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = onboarding_state.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Partnership members can update onboarding state" ON onboarding_state
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = onboarding_state.partnership_id
      AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = onboarding_state.partnership_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Partnership members can insert onboarding state" ON onboarding_state
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = partnership_id
      AND pm.user_id = auth.uid()
    )
  );

-- Partnership photos policies
CREATE POLICY "Public photos visible for live profiles" ON partnership_photos
  FOR SELECT USING (
    photo_type = 'public'
    AND EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = partnership_photos.partnership_id
      AND partnerships.profile_state = 'live'
    )
  );

CREATE POLICY "Private photos require grant" ON partnership_photos
  FOR SELECT USING (
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

CREATE POLICY "Owners can manage photos" ON partnership_photos
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM partnerships
      WHERE partnerships.id = partnership_photos.partnership_id
      AND partnerships.owner_id = auth.uid()
    )
  );

-- Photo grants policies
CREATE POLICY "Handshake participants can view grants" ON photo_grants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM handshakes h
      JOIN partnership_members pm ON pm.user_id = auth.uid()
      WHERE h.id = photo_grants.handshake_id
      AND (h.a_partnership = pm.partnership_id OR h.b_partnership = pm.partnership_id)
    )
  );

CREATE POLICY "Partnership can manage their grants" ON photo_grants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM handshakes h
      JOIN partnerships p ON (p.id = h.a_partnership OR p.id = h.b_partnership)
      WHERE h.id = photo_grants.handshake_id
      AND p.owner_id = auth.uid()
    )
  );

-- ============================================
-- PART 8: Grant Permissions
-- ============================================

GRANT EXECUTE ON FUNCTION get_or_create_onboarding_state TO authenticated;
GRANT EXECUTE ON FUNCTION mark_onboarding_step_complete TO authenticated;

-- ============================================
-- DONE! Your database is ready for HAEVN
-- ============================================