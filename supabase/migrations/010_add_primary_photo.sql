-- Add Primary Photo Support
-- Migration: 010_add_primary_photo.sql
-- Description: Add is_primary column to partnership_photos for avatar selection

-- Add is_primary column to partnership_photos
ALTER TABLE partnership_photos
ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

-- Create unique partial index: only ONE is_primary=true per partnership
CREATE UNIQUE INDEX idx_partnership_photos_primary
ON partnership_photos(partnership_id)
WHERE is_primary = true;

-- Create index for faster queries on primary photos
CREATE INDEX idx_partnership_photos_is_primary
ON partnership_photos(is_primary)
WHERE is_primary = true;

-- Add comment for documentation
COMMENT ON COLUMN partnership_photos.is_primary IS 'Indicates if this photo is the primary/avatar photo for the partnership. Only one photo can be primary per partnership.';

-- Function to auto-set first photo as primary if none exists
CREATE OR REPLACE FUNCTION ensure_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first photo for the partnership, make it primary
  IF NOT EXISTS (
    SELECT 1 FROM partnership_photos
    WHERE partnership_id = NEW.partnership_id
    AND is_primary = true
    AND id != NEW.id
  ) THEN
    NEW.is_primary = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-set first photo as primary
CREATE TRIGGER auto_set_primary_photo
  BEFORE INSERT ON partnership_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_primary_photo();

-- Function to reassign primary when primary photo is deleted
CREATE OR REPLACE FUNCTION reassign_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
  -- If deleted photo was primary, promote the next photo
  IF OLD.is_primary = true THEN
    UPDATE partnership_photos
    SET is_primary = true
    WHERE partnership_id = OLD.partnership_id
    AND id != OLD.id
    ORDER BY order_index ASC, created_at ASC
    LIMIT 1;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to reassign primary on deletion
CREATE TRIGGER reassign_primary_on_delete
  BEFORE DELETE ON partnership_photos
  FOR EACH ROW
  EXECUTE FUNCTION reassign_primary_photo();
