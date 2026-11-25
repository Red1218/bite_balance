-- A user's own name for a built-in exercise. The library row stays shared; history keeps its exercise_id.
create table public.exercise_names (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  primary key (user_id, exercise_id)
);

alter table public.exercise_names enable row level security;
create policy "Users can read own exercise names" on public.exercise_names for select using (auth.uid() = user_id);
create policy "Users can insert own exercise names" on public.exercise_names for insert with check (auth.uid() = user_id);
create policy "Users can update own exercise names" on public.exercise_names for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own exercise names" on public.exercise_names for delete using (auth.uid() = user_id);
create index exercise_names_exercise_idx on public.exercise_names (exercise_id);
