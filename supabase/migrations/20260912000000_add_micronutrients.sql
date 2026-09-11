ALTER TABLE public.daily_meals
  ADD COLUMN vitamin_c numeric DEFAULT 0,
  ADD COLUMN vitamin_d numeric DEFAULT 0,
  ADD COLUMN vitamin_b12 numeric DEFAULT 0,
  ADD COLUMN iron numeric DEFAULT 0,
  ADD COLUMN calcium numeric DEFAULT 0,
  ADD COLUMN potassium numeric DEFAULT 0,
  ADD COLUMN sodium numeric DEFAULT 0,
  ADD COLUMN magnesium numeric DEFAULT 0,
  ADD COLUMN zinc numeric DEFAULT 0;

ALTER TABLE public.saved_meals
  ADD COLUMN vitamin_c numeric DEFAULT 0,
  ADD COLUMN vitamin_d numeric DEFAULT 0,
  ADD COLUMN vitamin_b12 numeric DEFAULT 0,
  ADD COLUMN iron numeric DEFAULT 0,
  ADD COLUMN calcium numeric DEFAULT 0,
  ADD COLUMN potassium numeric DEFAULT 0,
  ADD COLUMN sodium numeric DEFAULT 0,
  ADD COLUMN magnesium numeric DEFAULT 0,
  ADD COLUMN zinc numeric DEFAULT 0;
