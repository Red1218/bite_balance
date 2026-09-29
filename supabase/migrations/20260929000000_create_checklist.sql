-- Daily checklist: recurring items and one row per tick (row exists = done that local day).
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  note        text,
  weekdays    smallint[] not null default '{0,1,2,3,4,5,6}'
              check (cardinality(weekdays) > 0 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.checklist_items enable row level security;

create policy "Users can read own checklist items" on public.checklist_items
  for select using (auth.uid() = user_id);
create policy "Users can insert own checklist items" on public.checklist_items
  for insert with check (auth.uid() = user_id);
create policy "Users can update own checklist items" on public.checklist_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own checklist items" on public.checklist_items
  for delete using (auth.uid() = user_id);

create index checklist_items_user_idx on public.checklist_items (user_id, position);

create table public.checklist_checks (
  item_id      uuid not null references public.checklist_items(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  checked_date date not null,
  created_at   timestamptz not null default now(),
  primary key (item_id, checked_date)
);

alter table public.checklist_checks enable row level security;

create policy "Users can read own checklist checks" on public.checklist_checks
  for select using (auth.uid() = user_id);
-- The item must also be yours, so nobody can tick someone else's item.
create policy "Users can insert own checklist checks" on public.checklist_checks
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.checklist_items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "Users can delete own checklist checks" on public.checklist_checks
  for delete using (auth.uid() = user_id);

create index checklist_checks_user_date_idx on public.checklist_checks (user_id, checked_date);
