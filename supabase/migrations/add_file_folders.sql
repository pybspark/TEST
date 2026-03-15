-- 일반(파일) 페이지용 폴더 (Supabase SQL Editor에서 실행)
+
+-- 1. 일반 파일용 폴더 테이블
+CREATE TABLE IF NOT EXISTS file_folders (
+  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
+  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
+  name TEXT NOT NULL,
+  created_at TIMESTAMPTZ DEFAULT NOW()
+);
+
+ALTER TABLE file_folders ENABLE ROW LEVEL SECURITY;
+
+CREATE POLICY "file_folders_owner_all" ON file_folders
+  FOR ALL USING (auth.uid() = owner_id);
+
+-- 2. files 테이블에 file_folder_id 추가 (일반 파일만 사용)
+ALTER TABLE files ADD COLUMN IF NOT EXISTS file_folder_id UUID REFERENCES file_folders(id) ON DELETE SET NULL;

