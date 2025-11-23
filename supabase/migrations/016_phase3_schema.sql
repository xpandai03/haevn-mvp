-- HAEVN Phase 3 Database Schema
-- Migration: 016_phase3_schema.sql
-- Description: Add tables for nudges, conversations, and profile views for Phase 3 dashboard

-- ======================
-- NUDGES TABLE
-- ======================
-- Stores nudge notifications from premium users to free users
CREATE TABLE IF NOT EXISTS nudges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    -- Prevent duplicate nudges from same sender to same recipient
    UNIQUE(sender_id, recipient_id),
    -- User can't nudge themselves
    CHECK (sender_id != recipient_id)
);

-- Indexes for nudges
CREATE INDEX idx_nudges_recipient ON nudges(recipient_id, created_at DESC);
CREATE INDEX idx_nudges_sender ON nudges(sender_id);
CREATE INDEX idx_nudges_unread ON nudges(recipient_id) WHERE read_at IS NULL;

-- RLS policies for nudges
ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;

-- Users can view nudges they sent
CREATE POLICY "Users can view their sent nudges"
    ON nudges FOR SELECT
    USING (auth.uid() = sender_id);

-- Users can view nudges they received
CREATE POLICY "Users can view their received nudges"
    ON nudges FOR SELECT
    USING (auth.uid() = recipient_id);

-- Premium users can send nudges (membership check happens in application layer)
CREATE POLICY "Users can send nudges"
    ON nudges FOR INSERT
    WITH CHECK (auth.uid() = sender_id);

-- Users can update read status on their received nudges
CREATE POLICY "Users can mark their nudges as read"
    ON nudges FOR UPDATE
    USING (auth.uid() = recipient_id)
    WITH CHECK (auth.uid() = recipient_id);

-- ======================
-- CONVERSATIONS TABLE
-- ======================
-- Stores direct message conversations between users
-- Note: This complements the existing handshakes system for matching
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant1_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Ensure consistent ordering (participant1 always < participant2)
    CHECK (participant1_id < participant2_id),
    -- Prevent duplicate conversations
    UNIQUE(participant1_id, participant2_id),
    -- User can't converse with themselves
    CHECK (participant1_id != participant2_id)
);

-- Indexes for conversations
CREATE INDEX idx_conversations_participant1 ON conversations(participant1_id);
CREATE INDEX idx_conversations_participant2 ON conversations(participant2_id);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- RLS policies for conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Users can view their own conversations
CREATE POLICY "Users can view their conversations"
    ON conversations FOR SELECT
    USING (
        auth.uid() = participant1_id OR
        auth.uid() = participant2_id
    );

-- Users can create conversations
CREATE POLICY "Users can create conversations"
    ON conversations FOR INSERT
    WITH CHECK (
        auth.uid() = participant1_id OR
        auth.uid() = participant2_id
    );

-- Trigger to update conversations.updated_at
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ======================
-- CONVERSATION_MESSAGES TABLE
-- ======================
-- Messages within conversations (separate from handshake messages)
CREATE TABLE IF NOT EXISTS conversation_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (length(content) <= 2000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Indexes for conversation_messages
CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_messages_sender ON conversation_messages(sender_id);
CREATE INDEX idx_conversation_messages_unread ON conversation_messages(conversation_id, sender_id) WHERE read_at IS NULL;

-- RLS policies for conversation_messages
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages in their conversations
CREATE POLICY "Users can view their conversation messages"
    ON conversation_messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_messages.conversation_id
            AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
        )
    );

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages in their conversations"
    ON conversation_messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_messages.conversation_id
            AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
        )
    );

-- Users can update read status on messages sent to them
CREATE POLICY "Users can mark messages as read"
    ON conversation_messages FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_messages.conversation_id
            AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
            AND sender_id != auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = conversation_messages.conversation_id
            AND (conversations.participant1_id = auth.uid() OR conversations.participant2_id = auth.uid())
            AND sender_id != auth.uid()
        )
    );

-- ======================
-- PROFILE_VIEWS TABLE
-- ======================
-- Track profile views for analytics
CREATE TABLE IF NOT EXISTS profile_views (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    viewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    -- User can't view their own profile (in this tracking system)
    CHECK (viewer_id != viewed_profile_id)
);

-- Indexes for profile_views
CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_id);
CREATE INDEX idx_profile_views_viewed ON profile_views(viewed_profile_id);
CREATE INDEX idx_profile_views_timestamp ON profile_views(viewed_at DESC);

-- RLS policies for profile_views
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

-- Users can view their own view history
CREATE POLICY "Users can view their own view history"
    ON profile_views FOR SELECT
    USING (auth.uid() = viewer_id);

-- Users can see who viewed their profile
CREATE POLICY "Users can see who viewed their profile"
    ON profile_views FOR SELECT
    USING (auth.uid() = viewed_profile_id);

-- Users can record profile views
CREATE POLICY "Users can record profile views"
    ON profile_views FOR INSERT
    WITH CHECK (auth.uid() = viewer_id);

-- ======================
-- HELPER FUNCTIONS
-- ======================

-- Function to get unread message count for a user in a conversation
CREATE OR REPLACE FUNCTION get_unread_message_count(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM conversation_messages
        WHERE conversation_id = p_conversation_id
        AND sender_id != p_user_id
        AND read_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get total profile views for a user
CREATE OR REPLACE FUNCTION get_profile_view_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(DISTINCT viewer_id)
        FROM profile_views
        WHERE viewed_profile_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all messages in a conversation as read
CREATE OR REPLACE FUNCTION mark_conversation_messages_read(
    p_conversation_id UUID,
    p_user_id UUID
)
RETURNS void AS $$
BEGIN
    UPDATE conversation_messages
    SET read_at = NOW()
    WHERE conversation_id = p_conversation_id
    AND sender_id != p_user_id
    AND read_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ======================
-- COMMENTS
-- ======================

COMMENT ON TABLE nudges IS 'Premium feature: Notifications from paid users to free users';
COMMENT ON TABLE conversations IS 'Direct message conversations between users (separate from handshake-based chats)';
COMMENT ON TABLE conversation_messages IS 'Messages within direct conversations';
COMMENT ON TABLE profile_views IS 'Analytics: track who viewed whose profile';

COMMENT ON FUNCTION get_unread_message_count IS 'Returns count of unread messages for a user in a specific conversation';
COMMENT ON FUNCTION get_profile_view_count IS 'Returns total number of unique profile views for a user';
COMMENT ON FUNCTION mark_conversation_messages_read IS 'Marks all unread messages in a conversation as read for a user';
