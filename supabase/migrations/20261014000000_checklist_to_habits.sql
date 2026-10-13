-- Checklist -> habit tracker. Additive: existing items become daily yes/no habits, existing ticks stay "done".
alter table public.checklist_items
  add column kind          text not null default 'check' check (kind in ('check', 'count', 'avoid')),
  add column target        integer not null default 1 check (target between 1 and 100000),
  add column unit          text,
  add column schedule      text not null default 'weekdays' check (schedule in ('weekdays', 'per_week', 'interval')),
  add column per_week      smallint check (per_week between 1 and 7),
  add column interval_days smallint check (interval_days between 2 and 60),
  add column icon          text not null default 'check',
  add column color         text not null default 'violet' check (color in ('red', 'orange', 'amber', 'sky', 'violet')),
  add column category      text check (category in ('supplements', 'fitness', 'nutrition', 'mind', 'sleep')),
  add column time_of_day   text not null default 'anytime' check (time_of_day in ('morning', 'afternoon', 'evening', 'anytime')),
  add column reminder_times text[] not null default '{}' check (cardinality(reminder_times) <= 5);

alter table public.checklist_items
  add constraint checklist_items_schedule_args check (
    (schedule <> 'per_week' or per_week is not null) and (schedule <> 'interval' or interval_days is not null)
  );

-- One row per habit per day. status: done (ticked / held / count logged), skipped (day frozen), slipped (avoid habit broken).
-- count is the logged amount for count habits; note is a free-text remark (e.g. why a day was skipped).
alter table public.checklist_checks
  add column status text not null default 'done' check (status in ('done', 'skipped', 'slipped')),
  add column count  integer check (count >= 0),
  add column note   text;

-- Counts and notes change in place, so rows need an update policy (same ownership rule as insert).
create policy "Users can update own checklist checks" on public.checklist_checks
  for update using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.checklist_items i where i.id = item_id and i.user_id = auth.uid())
  );
