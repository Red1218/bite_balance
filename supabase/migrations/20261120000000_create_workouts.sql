-- Workout tracker: an exercise library (built-in rows have no owner; people add their own),
-- finished workouts, and their completed sets.
create table public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade, -- null = built-in library
  name       text not null check (char_length(name) between 1 and 60),
  body_part  text not null check (body_part in ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'cardio', 'full_body')),
  secondary  text[] not null default '{}' check (secondary <@ array['chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'quads', 'hamstrings', 'glutes', 'calves', 'cardio', 'full_body']),
  equipment  text not null check (equipment in ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other')),
  kind       text not null check (kind in ('weight_reps', 'bodyweight_reps', 'weighted_bodyweight', 'assisted_bodyweight', 'duration', 'distance_duration')),
  created_at timestamptz not null default now()
);

alter table public.exercises enable row level security;
create policy "Users can read built-in and own exercises" on public.exercises
  for select using (user_id is null or auth.uid() = user_id);
create policy "Users can insert own exercises" on public.exercises
  for insert with check (auth.uid() = user_id);
create policy "Users can update own exercises" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own exercises" on public.exercises
  for delete using (auth.uid() = user_id);
create index exercises_user_idx on public.exercises (user_id);

create table public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 60),
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  check (ended_at >= started_at)
);

alter table public.workouts enable row level security;
create policy "Users can read own workouts" on public.workouts for select using (auth.uid() = user_id);
create policy "Users can insert own workouts" on public.workouts for insert with check (auth.uid() = user_id);
create policy "Users can update own workouts" on public.workouts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own workouts" on public.workouts for delete using (auth.uid() = user_id);
create index workouts_user_started_idx on public.workouts (user_id, started_at desc);

-- One row per completed set. position orders the exercises within the workout, set_no the sets
-- within an exercise. Only the columns the exercise's kind uses are filled.
create table public.workout_sets (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict, -- keep history
  position    smallint not null check (position >= 0),
  set_no      smallint not null check (set_no >= 1),
  set_type    text not null default 'normal' check (set_type in ('normal', 'warmup', 'failure', 'drop')),
  weight_kg   numeric(6, 2) check (weight_kg >= 0 and weight_kg < 1000),
  reps        integer check (reps between 0 and 1000),
  duration_s  integer check (duration_s between 0 and 86400),
  distance_km numeric(7, 3) check (distance_km >= 0 and distance_km < 1000),
  created_at  timestamptz not null default now()
);

alter table public.workout_sets enable row level security;
create policy "Users can read own workout sets" on public.workout_sets for select using (auth.uid() = user_id);
create policy "Users can insert own workout sets" on public.workout_sets for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid())
  and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = auth.uid()))
);
create policy "Users can delete own workout sets" on public.workout_sets for delete using (auth.uid() = user_id);
create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_exercise_idx on public.workout_sets (user_id, exercise_id);

-- Starter library.
insert into public.exercises (name, body_part, equipment, kind, secondary) values
  ('Bench press', 'chest', 'barbell', 'weight_reps', '{triceps,shoulders}'),
  ('Incline bench press', 'chest', 'barbell', 'weight_reps', '{shoulders,triceps}'),
  ('Decline bench press', 'chest', 'barbell', 'weight_reps', '{triceps}'),
  ('Dumbbell bench press', 'chest', 'dumbbell', 'weight_reps', '{triceps,shoulders}'),
  ('Incline dumbbell press', 'chest', 'dumbbell', 'weight_reps', '{shoulders,triceps}'),
  ('Dumbbell fly', 'chest', 'dumbbell', 'weight_reps', '{shoulders}'),
  ('Cable crossover', 'chest', 'cable', 'weight_reps', '{shoulders}'),
  ('Chest press machine', 'chest', 'machine', 'weight_reps', '{triceps}'),
  ('Pec deck', 'chest', 'machine', 'weight_reps', '{}'),
  ('Push-up', 'chest', 'bodyweight', 'bodyweight_reps', '{triceps,shoulders}'),
  ('Chest dip', 'chest', 'bodyweight', 'bodyweight_reps', '{triceps,shoulders}'),

  ('Deadlift', 'back', 'barbell', 'weight_reps', '{hamstrings,glutes}'),
  ('Barbell row', 'back', 'barbell', 'weight_reps', '{biceps}'),
  ('Rack pull', 'back', 'barbell', 'weight_reps', '{glutes}'),
  ('Pull-up', 'back', 'bodyweight', 'bodyweight_reps', '{biceps}'),
  ('Chin-up', 'back', 'bodyweight', 'bodyweight_reps', '{biceps}'),
  ('Weighted pull-up', 'back', 'bodyweight', 'weighted_bodyweight', '{biceps}'),
  ('Assisted pull-up', 'back', 'machine', 'assisted_bodyweight', '{biceps}'),
  ('Lat pulldown', 'back', 'cable', 'weight_reps', '{biceps}'),
  ('Seated cable row', 'back', 'cable', 'weight_reps', '{biceps}'),
  ('One-arm dumbbell row', 'back', 'dumbbell', 'weight_reps', '{biceps}'),
  ('T-bar row', 'back', 'machine', 'weight_reps', '{biceps}'),
  ('Inverted row', 'back', 'bodyweight', 'bodyweight_reps', '{biceps}'),
  ('Back extension', 'back', 'bodyweight', 'bodyweight_reps', '{glutes,hamstrings}'),
  ('Resistance band row', 'back', 'band', 'bodyweight_reps', '{biceps}'),

  ('Overhead press', 'shoulders', 'barbell', 'weight_reps', '{triceps}'),
  ('Seated dumbbell press', 'shoulders', 'dumbbell', 'weight_reps', '{triceps}'),
  ('Arnold press', 'shoulders', 'dumbbell', 'weight_reps', '{triceps}'),
  ('Lateral raise', 'shoulders', 'dumbbell', 'weight_reps', '{}'),
  ('Cable lateral raise', 'shoulders', 'cable', 'weight_reps', '{}'),
  ('Front raise', 'shoulders', 'dumbbell', 'weight_reps', '{}'),
  ('Rear delt fly', 'shoulders', 'dumbbell', 'weight_reps', '{back}'),
  ('Face pull', 'shoulders', 'cable', 'weight_reps', '{back}'),
  ('Shoulder press machine', 'shoulders', 'machine', 'weight_reps', '{triceps}'),
  ('Upright row', 'shoulders', 'barbell', 'weight_reps', '{biceps}'),
  ('Band pull-apart', 'shoulders', 'band', 'bodyweight_reps', '{back}'),

  ('Barbell curl', 'biceps', 'barbell', 'weight_reps', '{forearms}'),
  ('Dumbbell curl', 'biceps', 'dumbbell', 'weight_reps', '{forearms}'),
  ('Hammer curl', 'biceps', 'dumbbell', 'weight_reps', '{forearms}'),
  ('Preacher curl', 'biceps', 'barbell', 'weight_reps', '{}'),
  ('Cable curl', 'biceps', 'cable', 'weight_reps', '{}'),
  ('Incline dumbbell curl', 'biceps', 'dumbbell', 'weight_reps', '{}'),
  ('Concentration curl', 'biceps', 'dumbbell', 'weight_reps', '{}'),

  ('Triceps pushdown', 'triceps', 'cable', 'weight_reps', '{}'),
  ('Overhead triceps extension', 'triceps', 'dumbbell', 'weight_reps', '{}'),
  ('Cable overhead extension', 'triceps', 'cable', 'weight_reps', '{}'),
  ('Skull crusher', 'triceps', 'barbell', 'weight_reps', '{}'),
  ('Close-grip bench press', 'triceps', 'barbell', 'weight_reps', '{chest}'),
  ('Triceps dip', 'triceps', 'bodyweight', 'bodyweight_reps', '{chest,shoulders}'),
  ('Bench dip', 'triceps', 'bodyweight', 'bodyweight_reps', '{shoulders}'),

  ('Wrist curl', 'forearms', 'dumbbell', 'weight_reps', '{}'),
  ('Reverse curl', 'forearms', 'barbell', 'weight_reps', '{biceps}'),
  ('Dead hang', 'forearms', 'bodyweight', 'duration', '{back}'),

  ('Plank', 'abs', 'bodyweight', 'duration', '{}'),
  ('Side plank', 'abs', 'bodyweight', 'duration', '{}'),
  ('Crunch', 'abs', 'bodyweight', 'bodyweight_reps', '{}'),
  ('Bicycle crunch', 'abs', 'bodyweight', 'bodyweight_reps', '{}'),
  ('Hanging leg raise', 'abs', 'bodyweight', 'bodyweight_reps', '{forearms}'),
  ('Cable crunch', 'abs', 'cable', 'weight_reps', '{}'),
  ('Russian twist', 'abs', 'bodyweight', 'bodyweight_reps', '{}'),
  ('Ab wheel rollout', 'abs', 'other', 'bodyweight_reps', '{shoulders}'),

  ('Back squat', 'quads', 'barbell', 'weight_reps', '{glutes,hamstrings}'),
  ('Front squat', 'quads', 'barbell', 'weight_reps', '{glutes}'),
  ('Goblet squat', 'quads', 'kettlebell', 'weight_reps', '{glutes}'),
  ('Leg press', 'quads', 'machine', 'weight_reps', '{glutes}'),
  ('Leg extension', 'quads', 'machine', 'weight_reps', '{}'),
  ('Hack squat', 'quads', 'machine', 'weight_reps', '{glutes}'),
  ('Bulgarian split squat', 'quads', 'dumbbell', 'weight_reps', '{glutes}'),
  ('Walking lunge', 'quads', 'dumbbell', 'weight_reps', '{glutes}'),
  ('Bodyweight squat', 'quads', 'bodyweight', 'bodyweight_reps', '{glutes}'),

  ('Romanian deadlift', 'hamstrings', 'barbell', 'weight_reps', '{glutes,back}'),
  ('Dumbbell Romanian deadlift', 'hamstrings', 'dumbbell', 'weight_reps', '{glutes}'),
  ('Lying leg curl', 'hamstrings', 'machine', 'weight_reps', '{}'),
  ('Seated leg curl', 'hamstrings', 'machine', 'weight_reps', '{}'),
  ('Good morning', 'hamstrings', 'barbell', 'weight_reps', '{back,glutes}'),

  ('Hip thrust', 'glutes', 'barbell', 'weight_reps', '{hamstrings}'),
  ('Glute bridge', 'glutes', 'bodyweight', 'bodyweight_reps', '{hamstrings}'),
  ('Cable kickback', 'glutes', 'cable', 'weight_reps', '{}'),
  ('Hip abduction machine', 'glutes', 'machine', 'weight_reps', '{}'),
  ('Kettlebell swing', 'glutes', 'kettlebell', 'weight_reps', '{hamstrings,back}'),
  ('Step-up', 'glutes', 'dumbbell', 'weight_reps', '{quads}'),

  ('Standing calf raise', 'calves', 'machine', 'weight_reps', '{}'),
  ('Seated calf raise', 'calves', 'machine', 'weight_reps', '{}'),
  ('Dumbbell calf raise', 'calves', 'dumbbell', 'weight_reps', '{}'),
  ('Leg press calf raise', 'calves', 'machine', 'weight_reps', '{}'),

  ('Treadmill run', 'cardio', 'machine', 'distance_duration', '{}'),
  ('Outdoor run', 'cardio', 'bodyweight', 'distance_duration', '{}'),
  ('Walking', 'cardio', 'bodyweight', 'distance_duration', '{}'),
  ('Cycling', 'cardio', 'machine', 'distance_duration', '{quads}'),
  ('Rowing machine', 'cardio', 'machine', 'distance_duration', '{back}'),
  ('Swimming', 'cardio', 'bodyweight', 'distance_duration', '{}'),
  ('Elliptical', 'cardio', 'machine', 'duration', '{}'),
  ('Stair climber', 'cardio', 'machine', 'duration', '{quads,glutes}'),
  ('Jump rope', 'cardio', 'other', 'duration', '{calves}'),

  ('Burpee', 'full_body', 'bodyweight', 'bodyweight_reps', '{}'),
  ('Mountain climber', 'full_body', 'bodyweight', 'duration', '{abs}'),
  ('Clean and press', 'full_body', 'barbell', 'weight_reps', '{shoulders}'),
  ('Power clean', 'full_body', 'barbell', 'weight_reps', '{back}'),
  ('Thruster', 'full_body', 'barbell', 'weight_reps', '{quads,shoulders}'),
  ('Turkish get-up', 'full_body', 'kettlebell', 'weight_reps', '{shoulders,abs}'),
  ('Battle ropes', 'full_body', 'other', 'duration', '{shoulders}');
