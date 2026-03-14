-- ============================================
-- BIN CLOUD - Supabase SQL 스키마
-- Supabase > SQL Editor 에서 실행하세요
-- ============================================

-- 1. 사용자 프로필
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 가족 그룹
CREATE TABLE family_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '우리 가족',
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 0, 9),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 가족 구성원
CREATE TABLE family_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id UUID REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'owner' | 'member'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- 4. 파일 (사진/영상/파일 통합)
CREATE TABLE files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'photo' | 'video' | 'file'
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  is_shared BOOLEAN DEFAULT false,
  thumbnail_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 메모
CREATE TABLE notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  title TEXT DEFAULT '제목 없음',
  content TEXT DEFAULT '',
  is_shared BOOLEAN DEFAULT false,
  color TEXT DEFAULT 'yellow', -- 'yellow' | 'blue' | 'green' | 'pink'
  pinned BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security) 설정
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE files ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 가족은 조회 가능
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- files: 본인 파일 + 공유된 파일
CREATE POLICY "files_select" ON files FOR SELECT
  USING (owner_id = auth.uid() OR is_shared = true);
CREATE POLICY "files_insert" ON files FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "files_update" ON files FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "files_delete" ON files FOR DELETE
  USING (owner_id = auth.uid());

-- notes: 본인 + 공유
CREATE POLICY "notes_select" ON notes FOR SELECT
  USING (owner_id = auth.uid() OR is_shared = true);
CREATE POLICY "notes_insert" ON notes FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "notes_update" ON notes FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "notes_delete" ON notes FOR DELETE
  USING (owner_id = auth.uid());

-- family_members
CREATE POLICY "family_members_select" ON family_members FOR SELECT USING (true);
CREATE POLICY "family_members_insert" ON family_members FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 새 유저 가입시 프로필 자동 생성
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- Storage 버킷 생성 (아래는 SQL로 안 되면
-- Supabase Dashboard > Storage 에서 직접 만드세요)
-- ============================================
-- 버킷 이름: "family-files" (public)
-- 버킷 이름: "family-photos" (public)
