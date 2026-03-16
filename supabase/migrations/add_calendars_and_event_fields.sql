-- 캘린더 목록(개인/직장 등) 테이블
CREATE TABLE IF NOT EXISTS calendars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendars_owner ON calendars(owner_id);

ALTER TABLE calendars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendars_owner_select" ON calendars
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "calendars_owner_insert" ON calendars
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "calendars_owner_update" ON calendars
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "calendars_owner_delete" ON calendars
  FOR DELETE USING (auth.uid() = owner_id);

-- calendar_events 확장
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS calendar_id UUID REFERENCES calendars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_text TEXT,
  ADD COLUMN IF NOT EXISTS conference_url TEXT,
  ADD COLUMN IF NOT EXISTS repeat_rule JSONB,
  ADD COLUMN IF NOT EXISTS reminders JSONB;

CREATE INDEX IF NOT EXISTS idx_calendar_events_calendar ON calendar_events(calendar_id);

