CREATE TABLE partnership_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  invite_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_partnership_requests_code ON partnership_requests(invite_code);
CREATE INDEX idx_partnership_requests_email ON partnership_requests(to_email);
CREATE INDEX idx_partnership_requests_status ON partnership_requests(status);

ALTER TABLE partnership_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view invites they sent" ON partnership_requests
  FOR SELECT
  USING (from_user_id = auth.uid());

CREATE POLICY "Users can view invites sent to their email" ON partnership_requests
  FOR SELECT
  USING (to_email = auth.email());

CREATE POLICY "Users can create invites for their partnerships" ON partnership_requests
  FOR INSERT
  WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM partnership_members
      WHERE partnership_members.partnership_id = partnership_requests.partnership_id
      AND partnership_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update status of invites sent to them" ON partnership_requests
  FOR UPDATE
  USING (to_email = auth.email())
  WITH CHECK (to_email = auth.email());

CREATE OR REPLACE FUNCTION update_partnership_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER partnership_requests_updated_at
  BEFORE UPDATE ON partnership_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_partnership_request_timestamp();
