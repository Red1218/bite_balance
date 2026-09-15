ALTER TABLE public.indian_foods
  ADD COLUMN vitamin_c numeric DEFAULT 0,
  ADD COLUMN vitamin_d numeric DEFAULT 0,
  ADD COLUMN vitamin_b12 numeric DEFAULT 0,
  ADD COLUMN iron numeric DEFAULT 0,
  ADD COLUMN calcium numeric DEFAULT 0,
  ADD COLUMN potassium numeric DEFAULT 0,
  ADD COLUMN sodium numeric DEFAULT 0,
  ADD COLUMN magnesium numeric DEFAULT 0,
  ADD COLUMN zinc numeric DEFAULT 0;

-- Lets the import script upsert verified/system foods by name without ever
-- colliding with a user's own custom food of the same name.
CREATE UNIQUE INDEX idx_indian_foods_name_unique_verified
  ON public.indian_foods (lower(name))
  WHERE is_verified = true;
