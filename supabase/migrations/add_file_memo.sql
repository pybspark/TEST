-- 파일별 메모 (보안 폴더·일반 페이지에서 파일 클릭 시 메모/타임라인용)
ALTER TABLE files ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS memo_updated_at TIMESTAMPTZ;
