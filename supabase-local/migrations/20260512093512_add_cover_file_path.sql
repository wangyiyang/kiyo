-- Add cover_file_path to albums and songs
ALTER TABLE albums ADD COLUMN IF NOT EXISTS cover_file_path TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS cover_file_path TEXT;

-- Migrate existing cover_url data to cover_file_path
-- For covers bucket URLs like: https://xxx/storage/v1/object/public/covers/albums/uuid/123.png
UPDATE albums
SET cover_file_path = regexp_replace(cover_url, '^https?://.*/object/public/covers/', '')
WHERE cover_url IS NOT NULL AND cover_file_path IS NULL;

UPDATE songs
SET cover_file_path = regexp_replace(cover_url, '^https?://.*/object/public/covers/', '')
WHERE cover_url IS NOT NULL AND cover_file_path IS NULL;
