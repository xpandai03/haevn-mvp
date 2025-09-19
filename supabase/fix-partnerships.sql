-- First check if partnerships table exists
CREATE TABLE IF NOT EXISTS public.partnerships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  city TEXT DEFAULT 'New York',
  membership_tier TEXT DEFAULT 'free',
  profile_state TEXT DEFAULT 'draft',
  short_bio TEXT,
  long_bio TEXT,
  orientation JSONB DEFAULT '{}',
  structure JSONB DEFAULT '{}',
  intentions TEXT[] DEFAULT ARRAY[]::TEXT[],
  lifestyle_tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  discretion_summary TEXT,
  badges TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create partnership_members table if not exists
CREATE TABLE IF NOT EXISTS public.partnership_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partnership_id UUID NOT NULL REFERENCES partnerships(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Ensure unique membership
  UNIQUE(partnership_id, user_id)
);

-- Enable RLS
ALTER TABLE public.partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view partnerships they belong to" ON public.partnerships;
DROP POLICY IF EXISTS "Users can update own partnerships" ON public.partnerships;
DROP POLICY IF EXISTS "Users can create partnerships" ON public.partnerships;

DROP POLICY IF EXISTS "Users can view own memberships" ON public.partnership_members;
DROP POLICY IF EXISTS "Users can create memberships" ON public.partnership_members;

-- RLS policies for partnerships
CREATE POLICY "Users can view partnerships they belong to" ON public.partnerships
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = partnerships.id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own partnerships" ON public.partnerships
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM partnership_members pm
      WHERE pm.partnership_id = partnerships.id
      AND pm.user_id = auth.uid()
      AND pm.role = 'owner'
    )
  );

CREATE POLICY "Users can create partnerships" ON public.partnerships
  FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- RLS policies for partnership_members
CREATE POLICY "Users can view own memberships" ON public.partnership_members
  FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM partnership_members pm2
    WHERE pm2.partnership_id = partnership_members.partnership_id
    AND pm2.user_id = auth.uid()
  ));

CREATE POLICY "Users can create memberships" ON public.partnership_members
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON public.partnerships TO authenticated;
GRANT ALL ON public.partnership_members TO authenticated;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_partnerships_owner ON partnerships(owner_id);
CREATE INDEX IF NOT EXISTS idx_partnership_members_user ON partnership_members(user_id);
CREATE INDEX IF NOT EXISTS idx_partnership_members_partnership ON partnership_members(partnership_id);