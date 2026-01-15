-- Migration: Add image support to chat messages
-- This adds the image_url column to messages table and creates chat-media storage bucket

-- Add image_url column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create chat-media storage bucket for chat images
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: authenticated users can upload to chat-media
CREATE POLICY "Allow authenticated uploads to chat-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Policy: anyone can read from chat-media (public bucket)
CREATE POLICY "Allow public read from chat-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-media');

-- Policy: users can delete their own uploads
CREATE POLICY "Allow users to delete own chat-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
