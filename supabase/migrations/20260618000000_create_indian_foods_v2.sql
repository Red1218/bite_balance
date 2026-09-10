-- Recreate Indian Food Database Migration
DROP TABLE IF EXISTS public.food_aliases CASCADE;
DROP TABLE IF EXISTS public.indian_foods CASCADE;

-- Create scalable indian_foods table
CREATE TABLE public.indian_foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  serving_size DECIMAL NOT NULL DEFAULT 100, -- Default serving quantity (e.g. 100, 1, 50)
  serving_unit TEXT NOT NULL DEFAULT 'g',    -- Default serving unit (e.g. 'g', 'ml', 'piece')
  calories DECIMAL NOT NULL,                 -- Normalized per 100g or 100ml
  protein DECIMAL NOT NULL,                  -- Normalized per 100g or 100ml
  carbs DECIMAL NOT NULL,                    -- Normalized per 100g or 100ml
  fat DECIMAL NOT NULL,                      -- Normalized per 100g or 100ml
  fiber DECIMAL NOT NULL DEFAULT 0,          -- Normalized per 100g or 100ml
  is_verified BOOLEAN NOT NULL DEFAULT false,-- True for system-verified foods, false for user custom foods
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Nullable, tracks owner for custom foods
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create food_aliases table
CREATE TABLE public.food_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID REFERENCES public.indian_foods(id) ON DELETE CASCADE NOT NULL,
  alias TEXT NOT NULL UNIQUE
);

-- Enable RLS
ALTER TABLE public.indian_foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.food_aliases ENABLE ROW LEVEL SECURITY;

-- RLS Policies for indian_foods
CREATE POLICY "Allow public read access to indian_foods"
  ON public.indian_foods FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert custom foods"
  ON public.indian_foods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own custom foods"
  ON public.indian_foods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own custom foods"
  ON public.indian_foods FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for food_aliases
CREATE POLICY "Allow public read access to food_aliases"
  ON public.food_aliases FOR SELECT
  USING (true);

-- Extensions and Indexes for fast search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_indian_foods_name_trgm ON public.indian_foods USING gin (name gin_trgm_ops);
CREATE INDEX idx_indian_foods_category ON public.indian_foods (category);
CREATE INDEX idx_indian_foods_user_id ON public.indian_foods (user_id);

CREATE INDEX idx_food_aliases_alias_trgm ON public.food_aliases USING gin (alias gin_trgm_ops);
CREATE INDEX idx_food_aliases_food_id ON public.food_aliases (food_id);

-- Create search function for RPC
CREATE OR REPLACE FUNCTION public.search_foods(search_query text)
RETURNS SETOF public.indian_foods AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT f.*
  FROM public.indian_foods f
  LEFT JOIN public.food_aliases a ON f.id = a.food_id
  WHERE (f.is_verified = true OR f.user_id = auth.uid())
    AND (f.name ILIKE '%' || search_query || '%' OR a.alias ILIKE '%' || search_query || '%')
  ORDER BY f.is_verified DESC, f.name ASC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Seed verified Indian foods (Macros per 100g/ml)
INSERT INTO public.indian_foods (id, name, category, serving_size, serving_unit, calories, protein, carbs, fat, fiber, is_verified, image_url) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Idli (Steamed Rice Cake)', 'south_indian', 50, 'piece', 120, 3.2, 24.8, 0.4, 1.6, true, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=120&auto=format&fit=crop'),
  ('22222222-2222-2222-2222-222222222222', 'Plain Dosa', 'south_indian', 80, 'piece', 169, 3.5, 30.3, 3.5, 1.4, true, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=120&auto=format&fit=crop'),
  ('33333333-3333-3333-3333-333333333333', 'Masala Dosa', 'south_indian', 150, 'piece', 193, 3.2, 32.3, 5.7, 1.7, true, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=120&auto=format&fit=crop'),
  ('44444444-4444-4444-4444-444444444444', 'Suji Upma', 'south_indian', 100, 'g', 152, 3.2, 22.4, 5.1, 1.4, true, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=120&auto=format&fit=crop'),
  ('55555555-5555-5555-5555-555555555555', 'Ven Pongal', 'south_indian', 100, 'g', 212, 4.5, 35.0, 6.0, 1.5, true, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=120&auto=format&fit=crop'),
  ('66666666-6666-6666-6666-666666666666', 'White Rice (CookedBasmati)', 'rice_grains', 100, 'g', 130, 2.7, 28.0, 0.3, 0.4, true, 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop'),
  ('77777777-7777-7777-7777-777777777777', 'Brown Rice (Cooked)', 'rice_grains', 100, 'g', 111, 2.6, 23.0, 0.9, 1.8, true, 'https://images.unsplash.com/photo-1536304997881-a372c179924b?w=120&auto=format&fit=crop'),
  ('88888888-8888-8888-8888-888888888888', 'Chapati (Roti)', 'north_indian', 30, 'piece', 267, 9.3, 55.0, 1.3, 7.7, true, 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=120&auto=format&fit=crop'),
  ('99999999-9999-9999-9999-999999999999', 'Plain Paratha', 'north_indian', 100, 'piece', 326, 6.5, 48.0, 12.0, 3.2, true, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=120&auto=format&fit=crop'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sambar', 'curries', 100, 'g', 62, 2.1, 8.4, 2.2, 2.1, true, 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=120&auto=format&fit=crop'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dal Tadka', 'curries', 100, 'g', 110, 5.2, 15.4, 3.5, 4.2, true, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=120&auto=format&fit=crop'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Rajma Masala', 'curries', 100, 'g', 130, 4.8, 16.5, 4.5, 4.2, true, 'https://images.unsplash.com/photo-1585938338392-50a59970d2ee?w=120&auto=format&fit=crop'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Chole (Chana Masala)', 'curries', 100, 'g', 142, 5.1, 18.2, 5.2, 4.8, true, 'https://images.unsplash.com/photo-1585938338392-50a59970d2ee?w=120&auto=format&fit=crop'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Paneer Butter Masala', 'dairy', 100, 'g', 229, 7.8, 6.2, 19.5, 0.8, true, 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=120&auto=format&fit=crop'),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'Chicken Curry', 'chicken', 100, 'g', 138, 14.2, 3.2, 7.8, 0.7, true, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=120&auto=format&fit=crop'),
  ('12121212-1212-1212-1212-121212121212', 'Chicken Biryani', 'chicken', 100, 'g', 180, 9.2, 22.4, 6.5, 1.2, true, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=120&auto=format&fit=crop'),
  ('13131313-1313-1313-1313-131313131313', 'Egg Curry', 'eggs', 100, 'g', 132, 7.5, 3.8, 9.4, 0.5, true, 'https://images.unsplash.com/photo-1582722872445-44c5aba7e3c5?w=120&auto=format&fit=crop'),
  ('14141414-1414-1414-1414-141414141414', 'Boiled Egg', 'eggs', 50, 'piece', 155, 13.0, 1.1, 11.0, 0.0, true, 'https://images.unsplash.com/photo-1582722872445-44c5aba7e3c5?w=120&auto=format&fit=crop'),
  ('15151515-1515-1515-1515-151515151515', 'Banana', 'fruits', 120, 'piece', 89, 1.1, 22.8, 0.3, 2.6, true, 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=120&auto=format&fit=crop'),
  ('16161616-1616-1616-1616-161616161616', 'Apple', 'fruits', 180, 'piece', 52, 0.3, 14.0, 0.2, 2.4, true, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=120&auto=format&fit=crop'),
  ('17171717-1717-1717-1717-171717171717', 'Mixed Vegetable Sabzi', 'vegetables', 100, 'g', 88, 1.8, 10.2, 4.8, 2.6, true, 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=120&auto=format&fit=crop'),
  ('18181818-1818-1818-1818-181818181818', 'Fish Curry (Goan style)', 'seafood', 100, 'g', 125, 12.0, 3.5, 6.8, 0.6, true, 'https://images.unsplash.com/photo-1585938338392-50a59970d2ee?w=120&auto=format&fit=crop'),
  ('19191919-1919-1919-1919-191919191919', 'Samosa (Potato & Peas)', 'snacks', 75, 'piece', 349, 5.4, 42.9, 17.6, 2.8, true, 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=120&auto=format&fit=crop'),
  ('20202020-2020-2020-2020-202020202020', 'Masala Chai', 'beverages', 150, 'cup', 61, 1.6, 8.3, 2.1, 0.0, true, 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=120&auto=format&fit=crop');

-- Seed food aliases
INSERT INTO public.food_aliases (food_id, alias) VALUES
  ('88888888-8888-8888-8888-888888888888', 'Chapati'),
  ('88888888-8888-8888-8888-888888888888', 'Chapathi'),
  ('88888888-8888-8888-8888-888888888888', 'Roti'),
  ('88888888-8888-8888-8888-888888888888', 'Phulka'),
  ('88888888-8888-8888-8888-888888888888', 'Rotli'),
  ('22222222-2222-2222-2222-222222222222', 'Dosa'),
  ('22222222-2222-2222-2222-222222222222', 'Dosai'),
  ('33333333-3333-3333-3333-333333333333', 'Masala Dosa'),
  ('33333333-3333-3333-3333-333333333333', 'Masala Dosai'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sambar'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Sambhar'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Chole'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Chana Masala'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dal Tadka'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Dal Fry'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Yellow Dal'),
  ('66666666-6666-6666-6666-666666666666', 'White Rice'),
  ('77777777-7777-7777-7777-777777777777', 'Brown Rice'),
  ('99999999-9999-9999-9999-999999999999', 'Paratha'),
  ('14141414-1414-1414-1414-141414141414', 'Egg'),
  ('14141414-1414-1414-1414-141414141414', 'Boiled Egg'),
  ('15151515-1515-1515-1515-151515151515', 'Banana'),
  ('16161616-1616-1616-1616-161616161616', 'Apple');
