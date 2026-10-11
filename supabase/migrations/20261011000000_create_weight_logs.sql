-- Create weight_logs table: one weigh-in per user per day, so weight has a
-- history instead of profiles.weight being overwritten on every change.
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg   numeric(5, 2) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weight_logs_user_date_unique UNIQUE (user_id, logged_date)
);

-- Enable Row Level Security
ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own weigh-ins
CREATE POLICY "Users can read own weight logs"
  ON public.weight_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own weigh-ins
CREATE POLICY "Users can insert own weight logs"
  ON public.weight_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own weigh-ins
CREATE POLICY "Users can update own weight logs"
  ON public.weight_logs
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own weigh-ins
CREATE POLICY "Users can delete own weight logs"
  ON public.weight_logs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast per-user date-range lookups
CREATE INDEX IF NOT EXISTS weight_logs_user_date_idx ON public.weight_logs (user_id, logged_date);

-- Seed each user's history with the weight already on their profile, dated
-- the day the profile was last saved.
INSERT INTO public.weight_logs (user_id, logged_date, weight_kg, created_at, updated_at)
SELECT user_id, updated_at::date, weight, updated_at, updated_at
FROM public.profiles
WHERE weight IS NOT NULL AND weight > 0 AND weight < 500
ON CONFLICT (user_id, logged_date) DO NOTHING;
