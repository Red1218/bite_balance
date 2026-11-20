// Workout tracker: types, labels and the pure helpers the screens share. No imports, so the
// self-check (workouts.check.ts) runs straight under node.

export const BODY_PARTS = [
  ['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['biceps', 'Biceps'], ['triceps', 'Triceps'],
  ['forearms', 'Forearms'], ['abs', 'Abs'], ['quads', 'Quads'], ['hamstrings', 'Hamstrings'], ['glutes', 'Glutes'],
  ['calves', 'Calves'], ['cardio', 'Cardio'], ['full_body', 'Full body'],
] as const;
export type BodyPart = (typeof BODY_PARTS)[number][0];
export const BODY_PART_LABEL = Object.fromEntries(BODY_PARTS) as Record<BodyPart, string>;

export const EQUIPMENT = [
  ['barbell', 'Barbell'], ['dumbbell', 'Dumbbell'], ['machine', 'Machine'], ['cable', 'Cable'],
  ['bodyweight', 'Bodyweight'], ['kettlebell', 'Kettlebell'], ['band', 'Band'], ['other', 'Other'],
] as const;
export type Equipment = (typeof EQUIPMENT)[number][0];
export const EQUIPMENT_LABEL = Object.fromEntries(EQUIPMENT) as Record<Equipment, string>;

export type Field = 'kg' | 'reps' | 'time' | 'km';
export type ExerciseKind = 'weight_reps' | 'bodyweight_reps' | 'weighted_bodyweight' | 'assisted_bodyweight' | 'duration' | 'distance_duration';

// The columns each kind logs, in the order they show in a set row.
export const KINDS: Record<ExerciseKind, { label: string; fields: Field[]; heads: string[] }> = {
  weight_reps: { label: 'Weight & reps', fields: ['kg', 'reps'], heads: ['KG', 'REPS'] },
  bodyweight_reps: { label: 'Bodyweight reps', fields: ['reps'], heads: ['REPS'] },
  weighted_bodyweight: { label: 'Weighted bodyweight', fields: ['kg', 'reps'], heads: ['+KG', 'REPS'] },
  assisted_bodyweight: { label: 'Assisted bodyweight', fields: ['kg', 'reps'], heads: ['−KG', 'REPS'] },
  duration: { label: 'Duration', fields: ['time'], heads: ['TIME'] },
  distance_duration: { label: 'Distance & duration', fields: ['km', 'time'], heads: ['KM', 'TIME'] },
};
export const KIND_KEYS = Object.keys(KINDS) as ExerciseKind[];

export type SetType = 'normal' | 'warmup' | 'failure' | 'drop';
export const SET_TYPES: [SetType, string, string][] = [
  ['normal', 'Normal', ''], ['warmup', 'Warm-up', 'W'], ['failure', 'Failure', 'F'], ['drop', 'Drop set', 'D'],
];

export interface Exercise {
  id: string;
  user_id: string | null; // null = built-in
  name: string;
  body_part: BodyPart;
  secondary: BodyPart[];
  equipment: Equipment;
  kind: ExerciseKind;
}

export interface Workout {
  id: string;
  name: string;
  started_at: string;
  ended_at: string;
  note: string | null;
  routine_id: string | null;
}

export interface WorkoutSet {
  workout_id: string;
  exercise_id: string;
  position: number;
  set_no: number;
  set_type: SetType;
  weight_kg: number | null;
  reps: number | null;
  duration_s: number | null;
  distance_km: number | null;
}

// A workout in progress. Values stay as typed until the set is ticked.
export interface DraftSet {
  type: SetType;
  kg: string;
  reps: string;
  time: string;
  km: string;
  done: boolean;
}
export interface DraftExercise {
  exerciseId: string;
  sets: DraftSet[];
  rest?: number; // seconds after each set; 0 = off. Missing = DEFAULT_REST
}
export interface Draft {
  id: string;
  name: string;
  startedAt: string;
  exercises: DraftExercise[];
  routineId?: string | null;
  rest?: { endsAt: number; total: number } | null; // the rest countdown running now
}

export const DEFAULT_REST = 90;
export const REST_OPTIONS = [0, 30, 60, 90, 120, 180];
export const restLabel = (secs: number) => (secs ? fmtTime(secs) : 'Off');

/** A saved routine's exercise: its set types in order and the rest after each set. */
export interface RoutineItem {
  exerciseId: string;
  sets: SetType[];
  rest: number;
}
export interface Routine {
  id: string;
  name: string;
  position: number;
  items: RoutineItem[];
}

export const emptySet = (type: SetType = 'normal'): DraftSet => ({ type, kg: '', reps: '', time: '', km: '', done: false });

// ---- numbers ----

const num = (s: string) => {
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

/** "1:30" → 90, "1:02:00" → 3720; a bare number means minutes ("2" → 120). */
export const parseTime = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  if (!t.includes(':')) {
    const m = num(t);
    return m === null ? null : Math.round(m * 60);
  }
  const parts = t.split(':');
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const [a, b, c] = parts.map(Number);
  if (parts.length === 2) return b < 60 ? a * 60 + b : null;
  return b < 60 && c < 60 ? a * 3600 + b * 60 + c : null;
};

export const fmtTime = (secs: number) => {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** The saved values of a ticked draft set, or null if a field its kind needs is missing or out of range. */
export const setValues = (kind: ExerciseKind, s: DraftSet): Pick<WorkoutSet, 'weight_kg' | 'reps' | 'duration_s' | 'distance_km'> | null => {
  const out = { weight_kg: null as number | null, reps: null as number | null, duration_s: null as number | null, distance_km: null as number | null };
  for (const f of KINDS[kind].fields) {
    if (f === 'kg') {
      const v = num(s.kg);
      if (v === null || v >= 1000) return null;
      out.weight_kg = Math.round(v * 100) / 100;
    } else if (f === 'reps') {
      const v = num(s.reps);
      if (v === null || !Number.isInteger(v) || v < 1 || v > 1000) return null;
      out.reps = v;
    } else if (f === 'time') {
      const v = parseTime(s.time);
      if (v === null || v < 1 || v > 86400) return null;
      out.duration_s = v;
    } else {
      const v = num(s.km);
      if (v === null || v <= 0 || v >= 1000) return null;
      out.distance_km = Math.round(v * 1000) / 1000;
    }
  }
  return out;
};

/** A saved set back in the draft's text form, for the "previous" hints. */
export const toDraftValues = (s: WorkoutSet): Pick<DraftSet, 'kg' | 'reps' | 'time' | 'km'> => ({
  kg: s.weight_kg == null ? '' : trim(s.weight_kg),
  reps: s.reps == null ? '' : String(s.reps),
  time: s.duration_s == null ? '' : fmtTime(s.duration_s),
  km: s.distance_km == null ? '' : trim(s.distance_km),
});

/** How a saved set reads in the PREVIOUS column and in history: "60 × 8", "BW × 10", "2 km · 12:30". */
export const fmtSet = (kind: ExerciseKind, s: Pick<WorkoutSet, 'weight_kg' | 'reps' | 'duration_s' | 'distance_km'>) => {
  const kg = trim(s.weight_kg ?? 0);
  switch (kind) {
    case 'weight_reps': return `${kg} kg × ${s.reps}`;
    case 'bodyweight_reps': return `BW × ${s.reps}`;
    case 'weighted_bodyweight': return `+${kg} kg × ${s.reps}`;
    case 'assisted_bodyweight': return `−${kg} kg × ${s.reps}`;
    case 'duration': return fmtTime(s.duration_s ?? 0);
    case 'distance_duration': return `${trim(s.distance_km ?? 0)} km · ${fmtTime(s.duration_s ?? 0)}`;
  }
};

/** kg moved: weight × reps for the kinds that add load. Bodyweight isn't counted. */
export const setVolume = (kind: ExerciseKind, s: Pick<WorkoutSet, 'weight_kg' | 'reps'>) =>
  kind === 'weight_reps' || kind === 'weighted_bodyweight' ? (s.weight_kg ?? 0) * (s.reps ?? 0) : 0;

// ---- draft → rows ----

/** The ticked, valid sets of a draft as rows to save. set_no counts within each exercise. */
export const draftRows = (draft: Draft, kindOf: (exerciseId: string) => ExerciseKind | undefined): WorkoutSet[] => {
  const rows: WorkoutSet[] = [];
  let position = 0;
  for (const ex of draft.exercises) {
    const kind = kindOf(ex.exerciseId);
    if (!kind) continue;
    let setNo = 0;
    for (const s of ex.sets) {
      const values = s.done ? setValues(kind, s) : null;
      if (!values) continue;
      rows.push({ workout_id: draft.id, exercise_id: ex.exerciseId, position, set_no: ++setNo, set_type: s.type, ...values });
    }
    if (setNo) position++;
  }
  return rows;
};

/** Label in the SET column: normal sets are numbered, the others show their letter. */
export const setLabels = (sets: Pick<DraftSet, 'type'>[]) => {
  let n = 0;
  return sets.map((s) => (s.type === 'normal' ? String(++n) : SET_TYPES.find(([t]) => t === s.type)![2]));
};

// ---- history ----

/** Sets of each exercise from the most recent workout that has it. `workouts` newest first. */
export const lastSetsByExercise = (workouts: Workout[], sets: WorkoutSet[]) => {
  const order = new Map(workouts.map((w, i) => [w.id, i]));
  const best = new Map<string, number>();
  for (const s of sets) {
    const i = order.get(s.workout_id);
    if (i !== undefined && i < (best.get(s.exercise_id) ?? Infinity)) best.set(s.exercise_id, i);
  }
  const out = new Map<string, WorkoutSet[]>();
  for (const s of sets) {
    if (order.get(s.workout_id) !== best.get(s.exercise_id)) continue;
    out.set(s.exercise_id, [...(out.get(s.exercise_id) ?? []), s]);
  }
  for (const list of out.values()) list.sort((a, b) => a.set_no - b.set_no);
  return out;
};

/**
 * The workout to suggest next: of the recent distinct workout names, the one done longest ago,
 * so Push → Pull → Legs rotates on its own. One name only: repeat it. `workouts` newest first.
 */
export const nextUp = (workouts: Workout[]) => {
  const seen = new Map<string, Workout>();
  for (const w of workouts.slice(0, 12)) {
    const key = w.name.trim().toLowerCase();
    if (!seen.has(key)) seen.set(key, w);
  }
  const list = [...seen.values()];
  return list[list.length - 1] ?? null;
};

/** A new draft that repeats `workout`: same exercises in order, the same number of empty sets. */
export const draftFrom = (id: string, startedAt: string, name: string, sets: WorkoutSet[]): Draft => {
  const byPos = new Map<number, WorkoutSet[]>();
  for (const s of sets) byPos.set(s.position, [...(byPos.get(s.position) ?? []), s]);
  const exercises = [...byPos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, list]) => ({
      exerciseId: list[0].exercise_id,
      sets: list.sort((a, b) => a.set_no - b.set_no).map((s) => emptySet(s.set_type)),
    }));
  return { id, name, startedAt, exercises, routineId: null };
};

export const draftFromRoutine = (id: string, startedAt: string, routine: Routine): Draft => ({
  id,
  name: routine.name,
  startedAt,
  routineId: routine.id,
  exercises: routine.items.map((it) => ({ exerciseId: it.exerciseId, rest: it.rest, sets: it.sets.map((t) => emptySet(t)) })),
});

/** The routine a finished draft describes: its exercises with the sets that were ticked. */
export const routineItemsFromDraft = (draft: Draft, rows: WorkoutSet[]): RoutineItem[] => {
  // draftRows numbers positions over the exercises that have a saved set, in draft order.
  const out: RoutineItem[] = [];
  for (const ex of draft.exercises) {
    const mine = rows.filter((r) => r.position === out.length && r.exercise_id === ex.exerciseId);
    if (mine.length) out.push({ exerciseId: ex.exerciseId, sets: mine.map((r) => r.set_type), rest: ex.rest ?? DEFAULT_REST });
  }
  return out;
};

/** A saved workout as routine items (rest falls back to the default). */
export const routineItemsFromSets = (sets: WorkoutSet[]): RoutineItem[] =>
  draftFrom('', '', '', sets).exercises.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => s.type), rest: DEFAULT_REST }));

export const sameItems = (a: RoutineItem[], b: RoutineItem[]) => JSON.stringify(a) === JSON.stringify(b);

/** The routine after the one used most recently (wrapping round); the first if none was used yet. */
export const nextRoutine = (routines: Routine[], workouts: Workout[]) => {
  if (!routines.length) return null;
  const sorted = [...routines].sort((a, b) => a.position - b.position);
  const last = workouts.find((w) => w.routine_id && sorted.some((r) => r.id === w.routine_id));
  if (!last) return sorted[0];
  const i = sorted.findIndex((r) => r.id === last.routine_id);
  return sorted[(i + 1) % sorted.length];
};

export const workoutSummary = (sets: WorkoutSet[], kindOf: (exerciseId: string) => ExerciseKind | undefined) => ({
  sets: sets.length,
  exercises: new Set(sets.map((s) => s.exercise_id)).size,
  volume: sets.reduce((sum, s) => sum + setVolume(kindOf(s.exercise_id) ?? 'duration', s), 0),
});

export const minutesBetween = (from: string, to: string) => Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60000));

// ---- stats ----

/** Estimated one-rep max (Epley). */
export const epley = (kg: number, reps: number) => (reps <= 1 ? kg : kg * (1 + reps / 30));

export type Period = 'week' | 'month' | 'year';
const PERIOD_DAYS: Record<Period, number> = { week: 7, month: 30, year: 365 };

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const addDaysMs = (ms: number, n: number) => {
  const d = new Date(ms);
  d.setDate(d.getDate() + n);
  return d.getTime();
};

/** [start, end) of the period ending today, and of the same length just before it. */
export const periodRange = (period: Period, now: number) => {
  const end = addDaysMs(startOfDay(now), 1);
  const start = addDaysMs(end, -PERIOD_DAYS[period]);
  return { start, end, prevStart: addDaysMs(start, -PERIOD_DAYS[period]) };
};

export interface Bucket {
  label: string;
  start: number;
  end: number;
  current: boolean; // still filling up
}

/** Bars for the volume chart: days for a week, Monday weeks for 30 days, months for a year, clipped to the period. */
export const periodBuckets = (period: Period, now: number): Bucket[] => {
  const { start, end } = periodRange(period, now);
  const out: Bucket[] = [];
  if (period === 'week') {
    for (let s = start; s < end; s = addDaysMs(s, 1)) {
      out.push({ label: new Date(s).toLocaleDateString('en-GB', { weekday: 'short' }), start: s, end: addDaysMs(s, 1), current: false });
    }
  } else if (period === 'month') {
    const first = new Date(start);
    let s = addDaysMs(start, -((first.getDay() + 6) % 7)); // back to Monday
    for (; s < end; s = addDaysMs(s, 7)) {
      const from = Math.max(s, start);
      out.push({ label: new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), start: from, end: Math.min(addDaysMs(s, 7), end), current: false });
    }
  } else {
    const d = new Date(start);
    d.setDate(1);
    for (let s = d.getTime(); s < end; ) {
      const n = new Date(s);
      n.setMonth(n.getMonth() + 1);
      out.push({ label: new Date(s).toLocaleDateString('en-GB', { month: 'short' }), start: Math.max(s, start), end: Math.min(n.getTime(), end), current: false });
      s = n.getTime();
    }
  }
  out[out.length - 1].current = true;
  return out;
};

export const workoutStats = (
  period: Period,
  now: number,
  workouts: Workout[],
  sets: WorkoutSet[],
  byId: Map<string, Pick<Exercise, 'name' | 'kind' | 'body_part'>>,
) => {
  const { start, end, prevStart } = periodRange(period, now);
  const startedAt = new Map(workouts.map((w) => [w.id, Date.parse(w.started_at)]));
  const inRange = (w: Workout, a: number, b: number) => {
    const t = Date.parse(w.started_at);
    return t >= a && t < b;
  };
  const cur = workouts.filter((w) => inRange(w, start, end));
  const prev = workouts.filter((w) => inRange(w, prevStart, start));
  const ids = new Set(cur.map((w) => w.id));
  const prevIds = new Set(prev.map((w) => w.id));
  const curSets = sets.filter((s) => ids.has(s.workout_id));
  const kind = (s: WorkoutSet) => byId.get(s.exercise_id)?.kind ?? 'duration';
  const volumeOf = (list: WorkoutSet[]) => list.reduce((sum, s) => sum + setVolume(kind(s), s), 0);
  const minutes = (list: Workout[]) => list.reduce((sum, w) => sum + minutesBetween(w.started_at, w.ended_at), 0);

  const buckets = periodBuckets(period, now).map((b) => ({
    ...b,
    volume: volumeOf(curSets.filter((s) => {
      const t = startedAt.get(s.workout_id)!;
      return t >= b.start && t < b.end;
    })),
  }));

  // Main lifts: the weight exercises with the most sets this period, by their best estimated 1RM.
  const e1rm = (s: WorkoutSet) => (kind(s) === 'weight_reps' && s.weight_kg && s.reps ? epley(s.weight_kg, s.reps) : 0);
  const counts = new Map<string, number>();
  for (const s of curSets) if (e1rm(s)) counts.set(s.exercise_id, (counts.get(s.exercise_id) ?? 0) + 1);
  const lifts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([exerciseId]) => {
      const perWorkout = new Map<string, number>();
      for (const s of curSets) {
        if (s.exercise_id !== exerciseId) continue;
        perWorkout.set(s.workout_id, Math.max(perWorkout.get(s.workout_id) ?? 0, e1rm(s)));
      }
      const points = [...perWorkout.entries()].sort((a, b) => startedAt.get(a[0])! - startedAt.get(b[0])!).map(([, v]) => v);
      const before = sets.filter((s) => s.exercise_id === exerciseId && prevIds.has(s.workout_id)).reduce((m, s) => Math.max(m, e1rm(s)), 0);
      const best = Math.max(...points);
      return { exerciseId, name: byId.get(exerciseId)?.name ?? '', best, change: before ? best - before : null, points: points.slice(-8) };
    });

  const parts = new Map<BodyPart, number>();
  for (const s of curSets) {
    const p = byId.get(s.exercise_id)?.body_part;
    if (p) parts.set(p, (parts.get(p) ?? 0) + 1);
  }

  return {
    workouts: cur.length,
    prevWorkouts: prev.length,
    minutes: minutes(cur),
    volume: volumeOf(curSets),
    prevVolume: volumeOf(sets.filter((s) => prevIds.has(s.workout_id))),
    sets: curSets.length,
    buckets,
    lifts,
    parts: [...parts.entries()].sort((a, b) => b[1] - a[1]),
  };
};

// ---- records ----

type Metric = [label: string, value: (s: WorkoutSet) => number, show: (v: number) => string];
const METRICS: Record<ExerciseKind, Metric[]> = {
  weight_reps: [
    ['Est. 1RM', (s) => (s.weight_kg && s.reps ? epley(s.weight_kg, s.reps) : 0), (v) => `${Math.round(v)} kg`],
    ['Best weight', (s) => s.weight_kg ?? 0, (v) => `${trim(v)} kg`],
  ],
  weighted_bodyweight: [['Best added weight', (s) => s.weight_kg ?? 0, (v) => `+${trim(v)} kg`]],
  bodyweight_reps: [['Most reps', (s) => s.reps ?? 0, String]],
  assisted_bodyweight: [], // less help is the goal, so a "record" isn't one number going up
  duration: [['Longest', (s) => s.duration_s ?? 0, fmtTime]],
  distance_duration: [['Longest distance', (s) => s.distance_km ?? 0, (v) => `${trim(v)} km`]],
};

/** Records `rows` beat over every earlier set of the same exercise. A first-ever try isn't a record; warm-ups don't count. */
export const newRecords = (rows: WorkoutSet[], history: WorkoutSet[], kindOf: (exerciseId: string) => ExerciseKind | undefined) => {
  const out: { exerciseId: string; label: string; value: string }[] = [];
  for (const id of [...new Set(rows.map((r) => r.exercise_id))]) {
    const kind = kindOf(id);
    const now = rows.filter((r) => r.exercise_id === id && r.set_type !== 'warmup');
    const before = history.filter((h) => h.exercise_id === id && h.set_type !== 'warmup');
    if (!kind || !now.length || !before.length) continue;
    for (const [label, value, show] of METRICS[kind]) {
      const n = Math.max(...now.map(value));
      const b = Math.max(...before.map(value));
      if (Math.round(n * 10) > Math.round(b * 10)) out.push({ exerciseId: id, label, value: show(n) });
    }
  }
  return out;
};

// ---- one exercise ----

const MOST_REPS: Metric = ['Most reps', (s) => s.reps ?? 0, String];
/** The number charted over time for each kind (weight for lifts, reps, time or distance otherwise). */
export const chartMetric = (kind: ExerciseKind): Metric =>
  kind === 'weight_reps' ? METRICS.weight_reps[1] : kind === 'assisted_bodyweight' ? MOST_REPS : METRICS[kind][0];

export interface Session {
  workoutId: string;
  startedAt: string;
  sets: WorkoutSet[];
}

/** An exercise's best results, each with the session it came from. Warm-ups don't count. */
export const exerciseBests = (kind: ExerciseKind, sessions: Session[]) => {
  const metrics = kind === 'assisted_bodyweight' ? [MOST_REPS] : [...METRICS[kind]];
  if (kind === 'weight_reps') metrics.push(['Best set vol.', (s) => (s.weight_kg ?? 0) * (s.reps ?? 0), (v) => `${trim(v)} kg`]);
  return metrics.flatMap(([label, value, show]) => {
    let best: { set: WorkoutSet; at: string } | null = null;
    for (const ses of sessions)
      for (const s of ses.sets) if (s.set_type !== 'warmup' && value(s) > 0 && (!best || value(s) > value(best.set))) best = { set: s, at: ses.startedAt };
    return best ? [{ label, value: show(value(best.set)), set: best.set, at: best.at }] : [];
  });
};

/** One point per session, oldest first: the session's best on the charted metric. */
export const exerciseTrend = (kind: ExerciseKind, sessions: Session[]) => {
  const [, value] = chartMetric(kind);
  return [...sessions]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((s) => ({ at: s.startedAt, value: Math.max(0, ...s.sets.filter((x) => x.set_type !== 'warmup').map(value)) }))
    .filter((p) => p.value > 0);
};

// ---- calendar ----

/** Local yyyy-mm-dd. */
export const dayKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mondayOf = (ms: number) => addDaysMs(startOfDay(ms), -((new Date(ms).getDay() + 6) % 7));

/** The last `weeks` Monday-first weeks up to this one, each day marked trained, today or still to come. */
export const calendarWeeks = (workouts: Workout[], now: number, weeks = 5) => {
  const trained = new Set(workouts.map((w) => dayKey(Date.parse(w.started_at))));
  const today = dayKey(now);
  const first = addDaysMs(mondayOf(now), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, wi) => {
    const start = addDaysMs(first, 7 * wi);
    return {
      start,
      days: Array.from({ length: 7 }, (_, di) => {
        const ms = addDaysMs(start, di);
        const key = dayKey(ms);
        return { key, trained: trained.has(key), today: key === today, future: key > today };
      }),
    };
  });
};

export const STREAK_MIN = 2; // workouts that make a week count
/**
 * Weeks in a row with at least STREAK_MIN workouts. This week joins once it qualifies, and until
 * then doesn't break the run.
 */
export const weekStreak = (workouts: Workout[], now: number) => {
  const perWeek = new Map<number, number>();
  for (const w of workouts) {
    const m = mondayOf(Date.parse(w.started_at));
    perWeek.set(m, (perWeek.get(m) ?? 0) + 1);
  }
  let week = mondayOf(now);
  if ((perWeek.get(week) ?? 0) < STREAK_MIN) week = addDaysMs(week, -7);
  let n = 0;
  while ((perWeek.get(week) ?? 0) >= STREAK_MIN) {
    n++;
    week = addDaysMs(week, -7);
  }
  return n;
};
