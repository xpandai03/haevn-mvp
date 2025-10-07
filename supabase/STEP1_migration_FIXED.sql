ALTER TABLE partnership_photos ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partnership_photos_primary ON partnership_photos(partnership_id) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_partnership_photos_is_primary ON partnership_photos(is_primary) WHERE is_primary = true;

CREATE OR REPLACE FUNCTION ensure_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
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

DROP TRIGGER IF EXISTS auto_set_primary_photo ON partnership_photos;

CREATE TRIGGER auto_set_primary_photo
  BEFORE INSERT ON partnership_photos
  FOR EACH ROW
  EXECUTE FUNCTION ensure_primary_photo();

CREATE OR REPLACE FUNCTION reassign_primary_photo()
RETURNS TRIGGER AS $$
DECLARE
  next_photo_id UUID;
BEGIN
  IF OLD.is_primary = true THEN
    SELECT id INTO next_photo_id
    FROM partnership_photos
    WHERE partnership_id = OLD.partnership_id
    AND id != OLD.id
    ORDER BY order_index ASC, created_at ASC
    LIMIT 1;

    IF next_photo_id IS NOT NULL THEN
      UPDATE partnership_photos
      SET is_primary = true
      WHERE id = next_photo_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reassign_primary_on_delete ON partnership_photos;

CREATE TRIGGER reassign_primary_on_delete
  BEFORE DELETE ON partnership_photos
  FOR EACH ROW
  EXECUTE FUNCTION reassign_primary_photo();
