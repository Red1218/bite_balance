-- Daily steps and calories burned from Health Connect (the watch and phone), synced by the app so
-- the dashboard can read them: the data otherwise lives only on the phone. One row per user per day.
CREATE TABLE IF NOT EXISTS public.health_daily (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date date NOT NULL,
  steps       integer NOT NULL DEFAULT 0 CHECK (steps >= 0),
  burned_kcal numeric(7, 1) NOT NULL DEFAULT 0 CHECK (burned_kcal >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_daily_user_date_unique UNIQUE (user_id, logged_date)
);

ALTER TABLE public.health_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own health data"
  ON public.health_daily FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own health data"
  ON public.health_daily FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own health data"
  ON public.health_daily FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own health data"
  ON public.health_daily FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS health_daily_user_date_idx ON public.health_daily (user_id, logged_date);
