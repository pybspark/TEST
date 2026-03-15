-- 총관리자 발급 초대코드 (그룹과 무관, 1회 사용)
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_used_by ON invite_codes(used_by) WHERE used_by IS NOT NULL;

COMMENT ON TABLE invite_codes IS '관리자가 발급한 가입용 초대코드. 사용 시 used_by/used_at 설정, 그룹 배정은 별도.';
