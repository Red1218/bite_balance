alter table public.daily_meals
  add column grams numeric,
  add column unit text not null default 'g';
