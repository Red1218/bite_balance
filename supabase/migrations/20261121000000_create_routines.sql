-- Routines: saved workouts to start in one tap. items is the ordered exercise list:
-- [{ "exerciseId": uuid, "sets": ["normal" | "warmup" | "failure" | "drop", ...], "rest": seconds }]
create table public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  position   integer not null default 0,
  items      jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 50),
  created_at timestamptz not null default now()
);

alter table public.routines enable row level security;
create policy "Users can read own routines" on public.routines for select using (auth.uid() = user_id);
create policy "Users can insert own routines" on public.routines for insert with check (auth.uid() = user_id);
create policy "Users can update own routines" on public.routines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own routines" on public.routines for delete using (auth.uid() = user_id);
create index routines_user_idx on public.routines (user_id, position);

-- Which routine a workout was started from, so "Next up" can move on to the following one.
alter table public.workouts add column routine_id uuid references public.routines(id) on delete set null;
create index workouts_routine_idx on public.workouts (routine_id);
