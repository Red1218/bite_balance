-- Custom foods were readable by anyone (the read rule was `true`). Keep the verified
-- library public; a custom food is readable only by the user who made it.
drop policy "Allow public read access to indian_foods" on public.indian_foods;
create policy "Read verified and own foods" on public.indian_foods
  for select using (is_verified or auth.uid() = user_id);

-- Aliases follow their food: the subquery runs under the rule above.
drop policy "Allow public read access to food_aliases" on public.food_aliases;
create policy "Read aliases of readable foods" on public.food_aliases
  for select using (exists (select 1 from public.indian_foods f where f.id = food_id));
