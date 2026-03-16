-- 일정(캘린더) 기능용 테이블
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_owner_start ON calendar_events(owner_id, start_at);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_owner_select" ON calendar_events
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "calendar_events_owner_insert" ON calendar_events
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "calendar_events_owner_update" ON calendar_events
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "calendar_events_owner_delete" ON calendar_events
  FOR DELETE USING (auth.uid() = owner_id);

