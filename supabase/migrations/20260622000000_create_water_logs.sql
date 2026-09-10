-- Create water_logs table to track daily water intake per user
CREATE TABLE IF NOT EXISTS public.water_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  glasses     integer NOT NULL DEFAULT 0 CHECK (glasses >= 0),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT water_logs_user_date_unique UNIQUE (user_id, logged_date)
);

-- Enable Row Level Security
ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own water logs
CREATE POLICY "Users can read own water logs"
  ON public.water_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own water logs
CREATE POLICY "Users can insert own water logs"
  ON public.water_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own water logs
CREATE POLICY "Users can update own water logs"
  ON public.water_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own water logs
CREATE POLICY "Users can delete own water logs"
  ON public.water_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast per-user-date lookups
CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON public.water_logs (user_id, logged_date);
