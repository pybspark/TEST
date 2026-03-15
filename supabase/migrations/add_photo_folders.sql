-- 일반(사진) 페이지용 폴더 (Supabase SQL Editor에서 실행)

-- 1. 사진 폴더 테이블
CREATE TABLE IF NOT EXISTS photo_folders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE photo_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_folders_owner_all" ON photo_folders
  FOR ALL USING (auth.uid() = owner_id);

-- 2. files 테이블에 photo_folder_id 추가 (일반 사진만 사용)
ALTER TABLE files ADD COLUMN IF NOT EXISTS photo_folder_id UUID REFERENCES photo_folders(id) ON DELETE SET NULL;
