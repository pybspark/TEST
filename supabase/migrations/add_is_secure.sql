-- 보안 폴더 전용 파일·메모 (Supabase SQL Editor에서 실행)
ALTER TABLE files ADD COLUMN IF NOT EXISTS is_secure BOOLEAN DEFAULT false;
ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_secure BOOLEAN DEFAULT false;
