-- 이벤트 알림 중복 발송 방지용 로그
CREATE TABLE IF NOT EXISTS calendar_event_reminder_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES calendar_events(id) ON DELETE CASCADE NOT NULL,
  occurrence_at TIMESTAMPTZ NOT NULL,
  minutes_before INTEGER NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, occurrence_at, minutes_before)
);

CREATE INDEX IF NOT EXISTS idx_calendar_reminder_logs_owner ON calendar_event_reminder_logs(owner_id, sent_at);

ALTER TABLE calendar_event_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_reminder_logs_owner_select" ON calendar_event_reminder_logs
  FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "calendar_reminder_logs_owner_insert" ON calendar_event_reminder_logs
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "calendar_reminder_logs_owner_delete" ON calendar_event_reminder_logs
  FOR DELETE USING (auth.uid() = owner_id);

