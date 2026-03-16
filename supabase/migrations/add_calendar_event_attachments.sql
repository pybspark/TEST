-- calendar_events: 첨부파일(URL) + 첨부 메모
ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_memo TEXT;

