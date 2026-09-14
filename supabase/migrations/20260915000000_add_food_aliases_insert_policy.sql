-- food_aliases had RLS enabled with only a SELECT policy, so custom-food
-- alias inserts were silently rejected by the default-deny RLS behavior.
CREATE POLICY "Allow users to insert aliases for their own foods"
  ON public.food_aliases FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.indian_foods
      WHERE indian_foods.id = food_aliases.food_id
        AND indian_foods.user_id = auth.uid()
    )
  );
