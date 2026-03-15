-- photo_folders에 보안/일반 구분 플래그 추가
ALTER TABLE photo_folders
  ADD COLUMN IF NOT EXISTS is_secure BOOLEAN NOT NULL DEFAULT FALSE;

