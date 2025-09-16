-- HAEVN Database Policies
-- Migration: 002_policies.sql
-- Description: Row Level Security (RLS) policies for all tables

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE partnership_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE city_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE handshakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
-- Users can view and update their own profile
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- PARTNERSHIPS policies
-- Members can view partnerships they belong to
CREATE POLICY "partnerships_select_members" ON partnerships
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = partnerships.id
            AND partnership_members.user_id = auth.uid()
        )
    );

-- Only owners can update their partnerships
CREATE POLICY "partnerships_update_owner" ON partnerships
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

-- Only owners can create partnerships
CREATE POLICY "partnerships_insert_owner" ON partnerships
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

-- PARTNERSHIP_MEMBERS policies
-- Members can view membership of partnerships they belong to
CREATE POLICY "partnership_members_select" ON partnership_members
    FOR SELECT
    USING (
        -- User is a member of this partnership
        user_id = auth.uid()
        OR
        -- User is the owner of this partnership
        EXISTS (
            SELECT 1 FROM partnerships
            WHERE partnerships.id = partnership_members.partnership_id
            AND partnerships.owner_id = auth.uid()
        )
    );

-- Users can add themselves or owner can add members
CREATE POLICY "partnership_members_insert" ON partnership_members
    FOR INSERT
    WITH CHECK (
        -- User is adding themselves
        user_id = auth.uid()
        OR
        -- User is the owner of the partnership
        EXISTS (
            SELECT 1 FROM partnerships
            WHERE partnerships.id = partnership_members.partnership_id
            AND partnerships.owner_id = auth.uid()
        )
    );

-- Members can remove themselves or owner can remove members
CREATE POLICY "partnership_members_delete" ON partnership_members
    FOR DELETE
    USING (
        -- User is removing themselves
        user_id = auth.uid()
        OR
        -- User is the owner of the partnership
        EXISTS (
            SELECT 1 FROM partnerships
            WHERE partnerships.id = partnership_members.partnership_id
            AND partnerships.owner_id = auth.uid()
        )
    );

-- SURVEY_RESPONSES policies
-- Members can view and edit survey responses for their partnerships
CREATE POLICY "survey_responses_select" ON survey_responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = survey_responses.partnership_id
            AND partnership_members.user_id = auth.uid()
        )
    );

CREATE POLICY "survey_responses_insert" ON survey_responses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = survey_responses.partnership_id
            AND partnership_members.user_id = auth.uid()
        )
    );

CREATE POLICY "survey_responses_update" ON survey_responses
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = survey_responses.partnership_id
            AND partnership_members.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = survey_responses.partnership_id
            AND partnership_members.user_id = auth.uid()
        )
    );

-- CITY_STATUS policies
-- Everyone can read city status (public data)
CREATE POLICY "city_status_select_all" ON city_status
    FOR SELECT
    USING (true);

-- SIGNALS policies
-- Users can create signals from partnerships they belong to
CREATE POLICY "signals_insert" ON signals
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = signals.from_partnership
            AND partnership_members.user_id = auth.uid()
        )
    );

-- Users can view signals involving their partnerships
CREATE POLICY "signals_select" ON signals
    FOR SELECT
    USING (
        -- User is member of the 'from' partnership
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = signals.from_partnership
            AND partnership_members.user_id = auth.uid()
        )
        OR
        -- User is member of the 'to' partnership
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = signals.to_partnership
            AND partnership_members.user_id = auth.uid()
        )
    );

-- HANDSHAKES policies
-- Users can view handshakes involving their partnerships
CREATE POLICY "handshakes_select" ON handshakes
    FOR SELECT
    USING (
        -- User is member of partnership A
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = handshakes.a_partnership
            AND partnership_members.user_id = auth.uid()
        )
        OR
        -- User is member of partnership B
        EXISTS (
            SELECT 1 FROM partnership_members
            WHERE partnership_members.partnership_id = handshakes.b_partnership
            AND partnership_members.user_id = auth.uid()
        )
    );

-- Handshakes are created via server/function when mutual signals exist
-- No direct insert policy for users

-- MESSAGES policies
-- Users can view messages in handshakes they're part of
CREATE POLICY "messages_select" ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM handshakes h
            JOIN partnership_members pm_a ON pm_a.partnership_id = h.a_partnership
            JOIN partnership_members pm_b ON pm_b.partnership_id = h.b_partnership
            WHERE h.id = messages.handshake_id
            AND (pm_a.user_id = auth.uid() OR pm_b.user_id = auth.uid())
        )
    );

-- Users can send messages in handshakes they're part of
CREATE POLICY "messages_insert" ON messages
    FOR INSERT
    WITH CHECK (
        sender_user = auth.uid()
        AND
        EXISTS (
            SELECT 1 FROM handshakes h
            JOIN partnership_members pm_a ON pm_a.partnership_id = h.a_partnership
            JOIN partnership_members pm_b ON pm_b.partnership_id = h.b_partnership
            WHERE h.id = messages.handshake_id
            AND (pm_a.user_id = auth.uid() OR pm_b.user_id = auth.uid())
        )
    );

-- SUBSCRIPTIONS policies
-- Users can view and update their own subscription
CREATE POLICY "subscriptions_select_own" ON subscriptions
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "subscriptions_update_own" ON subscriptions
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "subscriptions_insert_own" ON subscriptions
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Function to automatically create handshakes when mutual signals exist
CREATE OR REPLACE FUNCTION check_mutual_signals()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's a reciprocal signal
    IF EXISTS (
        SELECT 1 FROM signals
        WHERE from_partnership = NEW.to_partnership
        AND to_partnership = NEW.from_partnership
    ) THEN
        -- Create a handshake (with consistent ordering)
        INSERT INTO handshakes (a_partnership, b_partnership)
        VALUES (
            LEAST(NEW.from_partnership, NEW.to_partnership),
            GREATEST(NEW.from_partnership, NEW.to_partnership)
        )
        ON CONFLICT (a_partnership, b_partnership) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_handshake_on_mutual_signal
    AFTER INSERT ON signals
    FOR EACH ROW
    EXECUTE FUNCTION check_mutual_signals();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO subscriptions (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile and subscription on signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();