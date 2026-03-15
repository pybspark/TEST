-- 보안 폴더 하위 폴더 (Supabase SQL Editor에서 실행)

-- 1. 보안 폴더용 폴더 테이블
CREATE TABLE IF NOT EXISTS secure_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE secure_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secure_folders_owner_all" ON secure_folders
  FOR ALL USING (auth.uid() = owner_id);

-- 2. files 테이블에 folder_id 추가 (보안 폴더 파일만 사용)
ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES secure_folders(id) ON DELETE SET NULL;
