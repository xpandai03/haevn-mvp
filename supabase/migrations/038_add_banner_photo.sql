-- Add Banner Photo Support
-- Migration: 038_add_banner_photo.sql
-- Description: Add is_banner column to partnership_photos so the
-- profile hero cover and circular avatar can point at different
-- photos. Mirrors the is_primary pattern from migration 010.

-- 1. Column ----------------------------------------------------------
ALTER TABLE partnership_photos
ADD COLUMN IF NOT EXISTS is_banner BOOLEAN DEFAULT false;

-- 2. At most one banner per partnership ------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_partnership_photos_banner
ON partnership_photos(partnership_id)
WHERE is_banner = true;

CREATE INDEX IF NOT EXISTS idx_partnership_photos_is_banner
ON partnership_photos(is_banner)
WHERE is_banner = true;

-- 3. Backfill: existing primary photos become banner photos ---------
-- Profile page used to render primary as both avatar and hero cover.
-- Setting is_banner = is_primary preserves that visual until the user
-- explicitly picks a different banner from Manage Photos.
UPDATE partnership_photos
SET is_banner = true
WHERE is_primary = true
  AND is_banner = false;

-- 4. Auto-set first uploaded photo as banner -------------------------
CREATE OR REPLACE FUNCTION ensure_banner_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM partnership_photos
    WHERE partnership_id = NEW.partnership_id
      AND is_banner = true
      AND id != NEW.id
  ) THEN
    NEW.is_banner = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_set_banner_photo ON partnership_photos;
CREATE TRIGGER auto_set_banner_photo
  BEFORE INSERT ON partnership_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_banner_photo();

-- 5. Reassign banner when banner photo is deleted -------------------
CREATE OR REPLACE FUNCTION reassign_banner_photo()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_banner = true THEN
    -- Prefer promoting the current primary; fall back to oldest
    -- remaining photo by order_index/created_at.
    UPDATE partnership_photos
    SET is_banner = true
    WHERE id = (
      SELECT id FROM partnership_photos
      WHERE partnership_id = OLD.partnership_id
        AND id != OLD.id
      ORDER BY is_primary DESC, order_index ASC, created_at ASC
      LIMIT 1
    );
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reassign_banner_on_delete ON partnership_photos;
CREATE TRIGGER reassign_banner_on_delete
  BEFORE DELETE ON partnership_photos
  FOR EACH ROW
  EXECUTE FUNCTION reassign_banner_photo();
