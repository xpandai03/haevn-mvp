-- Create message_reads table for tracking read status
CREATE TABLE IF NOT EXISTS message_reads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  handshake_id UUID NOT NULL REFERENCES handshakes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Ensure unique read status per user per handshake
  UNIQUE(handshake_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_reads_handshake_user ON message_reads(handshake_id, user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);

-- Enable RLS
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only manage their own read statuses
CREATE POLICY "Users can manage own read status" ON message_reads
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_message_reads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_message_reads_timestamp
  BEFORE UPDATE ON message_reads
  FOR EACH ROW
  EXECUTE FUNCTION update_message_reads_updated_at();