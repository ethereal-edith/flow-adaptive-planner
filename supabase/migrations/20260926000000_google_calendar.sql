ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS google_calendar_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'calendar_events_source_check'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT calendar_events_source_check CHECK (source IN ('manual', 'google'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_google_event
  ON public.calendar_events(user_id, google_event_id);

CREATE TABLE IF NOT EXISTS public.user_google_tokens (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  scope TEXT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their own Google tokens" ON public.user_google_tokens;
CREATE POLICY "Users can access their own Google tokens" ON public.user_google_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
