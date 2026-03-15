-- 보안 폴더 2차 비밀번호용 (Supabase SQL Editor에서 실행)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS secure_pin_hash TEXT;
