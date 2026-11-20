// Self-check for workouts.ts. Run: node src/lib/workouts.check.ts
import {
  draftFrom, draftFromRoutine, draftRows, newRecords, nextRoutine, routineItemsFromDraft, emptySet, epley, fmtSet, lastSetsByExercise, nextUp, parseTime, periodBuckets, setLabels, setValues, workoutStats,
  type Draft, type Routine, type Workout, type WorkoutSet,
} from './workouts.ts';

let failures = 0;
const eq = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

eq(parseTime('1:30'), 90, 'm:ss');
eq(parseTime('1:02:00'), 3720, 'h:mm:ss');
eq(parseTime('2'), 120, 'bare number is minutes');
eq(parseTime('1:75'), null, 'seconds over 59');
eq(parseTime('abc'), null, 'junk');

const set = (over: Partial<ReturnType<typeof emptySet>>) => ({ ...emptySet(), done: true, ...over });
eq(setValues('weight_reps', set({ kg: '62,5', reps: '8' })), { weight_kg: 62.5, reps: 8, duration_s: null, distance_km: null }, 'comma decimal');
eq(setValues('weight_reps', set({ kg: '60', reps: '' })), null, 'missing reps');
eq(setValues('weight_reps', set({ kg: '60', reps: '7.5' })), null, 'fractional reps');
eq(setValues('bodyweight_reps', set({ reps: '10' })), { weight_kg: null, reps: 10, duration_s: null, distance_km: null }, 'bodyweight ignores kg');
eq(setValues('distance_duration', set({ km: '2', time: '12:30' })), { weight_kg: null, reps: null, duration_s: 750, distance_km: 2 }, 'run');

eq(fmtSet('weight_reps', { weight_kg: 60, reps: 8, duration_s: null, distance_km: null }), '60 kg × 8', 'fmt weight');
eq(fmtSet('distance_duration', { weight_kg: null, reps: null, duration_s: 750, distance_km: 2 }), '2 km · 12:30', 'fmt run');
eq(setLabels([{ type: 'warmup' }, { type: 'normal' }, { type: 'drop' }, { type: 'normal' }]), ['W', '1', 'D', '2'], 'set labels');

// Only ticked valid sets are saved; an exercise with none doesn't take a position.
const draft: Draft = {
  id: 'w', name: 'Push', startedAt: '2026-11-20T10:00:00Z',
  exercises: [
    { exerciseId: 'a', sets: [set({ kg: '60', reps: '8' }), { ...set({ kg: '60', reps: '8' }), done: false }] },
    { exerciseId: 'b', sets: [set({ kg: '', reps: '' })] },
    { exerciseId: 'c', sets: [set({ type: 'warmup', reps: '10' })] },
  ],
};
const kinds: Record<string, 'weight_reps' | 'bodyweight_reps'> = { a: 'weight_reps', b: 'weight_reps', c: 'bodyweight_reps' };
eq(
  draftRows(draft, (id) => kinds[id]).map((r) => [r.exercise_id, r.position, r.set_no, r.set_type]),
  [['a', 0, 1, 'normal'], ['c', 1, 1, 'warmup']],
  'draft rows',
);

const w = (id: string, name: string, day: number): Workout => ({ id, name, started_at: `2026-11-${day}T10:00:00Z`, ended_at: `2026-11-${day}T11:00:00Z`, note: null, routine_id: null });
const ws = (workout_id: string, exercise_id: string, set_no: number, weight_kg: number, position = 0): WorkoutSet => ({
  workout_id, exercise_id, position, set_no, set_type: 'normal', weight_kg, reps: 8, duration_s: null, distance_km: null,
});
const history = [w('w3', 'Push Day', 18), w('w2', 'Leg Day', 16), w('w1', 'Pull Day', 14), w('w0', 'push day', 12)];
eq(nextUp(history)?.id, 'w1', 'rotation picks the one done longest ago');
eq(nextUp([w('x', 'Full body', 1)])?.id, 'x', 'single name repeats');
eq(nextUp([]), null, 'no history');

const sets = [ws('w0', 'bench', 1, 55), ws('w3', 'bench', 2, 62.5), ws('w3', 'bench', 1, 60), ws('w1', 'row', 1, 50)];
const last = lastSetsByExercise(history, sets);
eq(last.get('bench')?.map((s) => s.weight_kg), [60, 62.5], 'latest workout, sorted by set');
eq(last.get('row')?.map((s) => s.workout_id), ['w1'], 'other exercise');

const again = draftFrom('n', 't', 'Pull Day', [ws('w1', 'curl', 1, 10, 1), ws('w1', 'row', 2, 50, 0), ws('w1', 'row', 1, 50, 0)]);
eq(again.exercises.map((e) => [e.exerciseId, e.sets.length]), [['row', 2], ['curl', 1]], 'repeat keeps order and set count');

// ---- stats ----
eq(Math.round(epley(60, 8) * 10) / 10, 76, 'epley');
eq(epley(100, 1), 100, 'epley single');

const now = new Date(2026, 10, 20, 18, 0).getTime(); // Fri 20 Nov, local time
eq(periodBuckets('week', now).map((b) => b.label), ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 'week buckets end today');
const month = periodBuckets('month', now);
eq([month.length, month[0].label, month[month.length - 1].label, month[month.length - 1].current], [5, '22 Oct', '16 Nov', true], 'month buckets by Monday week, clipped');
const year = periodBuckets('year', now);
eq([year.length, year[year.length - 1].label], [13, 'Nov'], 'year buckets by month');

const at = (id: string, name: string, y: number, m: number, d: number): Workout => {
  const s = new Date(y, m, d, 10).toISOString();
  return { id, name, started_at: s, ended_at: new Date(y, m, d, 11).toISOString(), note: null, routine_id: null };
};
const statsWorkouts = [at('a', 'Push', 2026, 10, 18), at('b', 'Push', 2026, 10, 11), at('c', 'Push', 2026, 9, 10)];
const statsSets = [
  ws('a', 'bench', 1, 62.5), ws('a', 'bench', 2, 60), ws('b', 'bench', 1, 60), ws('c', 'bench', 1, 55), ws('a', 'plank', 1, 0, 1),
];
const ex = new Map([
  ['bench', { name: 'Bench press', kind: 'weight_reps' as const, body_part: 'chest' as const }],
  ['plank', { name: 'Plank', kind: 'duration' as const, body_part: 'abs' as const }],
]);
const st = workoutStats('month', now, statsWorkouts, statsSets, ex);
eq([st.workouts, st.prevWorkouts, st.sets, st.volume, st.prevVolume], [2, 1, 4, 1460, 440], '30-day totals vs the 30 days before');
eq(st.lifts.map((l) => [l.name, Math.round(l.best * 10) / 10, Math.round((l.change ?? 0) * 10) / 10, l.points.length]), [['Bench press', 79.2, 9.5, 2]], 'top lift');
eq(st.parts, [['chest', 3], ['abs', 1]], 'sets by muscle');

// ---- routines ----
const routines: Routine[] = [
  { id: 'r2', name: 'Pull', position: 1, items: [] },
  { id: 'r1', name: 'Push', position: 0, items: [{ exerciseId: 'bench', sets: ['warmup', 'normal'], rest: 120 }] },
  { id: 'r3', name: 'Legs', position: 2, items: [] },
];
const used = (id: string, routine_id: string | null) => ({ ...w(id, 'x', 10), routine_id });
eq(nextRoutine(routines, [])?.id, 'r1', 'first routine when none used');
eq(nextRoutine(routines, [used('a', 'r2'), used('b', 'r1')])?.id, 'r3', 'after the latest routine');
eq(nextRoutine(routines, [used('a', 'r3')])?.id, 'r1', 'wraps round');
eq(nextRoutine(routines, [used('a', null), used('b', 'gone'), used('c', 'r1')])?.id, 'r2', 'skips workouts without a known routine');
eq(nextRoutine([], [used('a', 'r1')]), null, 'no routines');

const fromRoutine = draftFromRoutine('d', 't', routines[1]);
eq([fromRoutine.routineId, fromRoutine.exercises[0].rest, fromRoutine.exercises[0].sets.map((s) => s.type)], ['r1', 120, ['warmup', 'normal']], 'draft from routine');

// The same exercise twice, the middle one with nothing ticked: positions follow saved exercises only.
const twice: Draft = {
  id: 'w', name: 'x', startedAt: 't',
  exercises: [
    { exerciseId: 'a', rest: 60, sets: [set({ kg: '60', reps: '8' })] },
    { exerciseId: 'b', sets: [{ ...set({ kg: '1', reps: '1' }), done: false }] },
    { exerciseId: 'a', sets: [set({ type: 'drop', kg: '40', reps: '10' })] },
  ],
};
const twiceRows = draftRows(twice, () => 'weight_reps');
eq(routineItemsFromDraft(twice, twiceRows), [
  { exerciseId: 'a', sets: ['normal'], rest: 60 },
  { exerciseId: 'a', sets: ['drop'], rest: 90 },
], 'routine items from draft');

// ---- records ----
const rec = (exercise_id: string, weight_kg: number, reps: number, set_type: WorkoutSet['set_type'] = 'normal'): WorkoutSet =>
  ({ ...ws('now', exercise_id, 1, weight_kg), reps, set_type });
eq(newRecords([rec('bench', 65, 5)], [rec('bench', 60, 8)], () => 'weight_reps').map((r) => r.label), ['Best weight'], 'heavier but lower 1RM');
eq(newRecords([rec('bench', 60, 10)], [rec('bench', 60, 8)], () => 'weight_reps').map((r) => [r.label, r.value]), [['Est. 1RM', '80 kg']], 'more reps raises 1RM');
eq(newRecords([rec('bench', 60, 8)], [], () => 'weight_reps'), [], 'first try is not a record');
eq(newRecords([rec('bench', 100, 1, 'warmup')], [rec('bench', 60, 8)], () => 'weight_reps'), [], 'warm-ups never count');
eq(newRecords([{ ...rec('pull', 0, 12), weight_kg: null }], [{ ...rec('pull', 0, 10), weight_kg: null }], () => 'bodyweight_reps').map((r) => r.value), ['12'], 'most reps');

if (failures) {
  console.error(`${failures} workouts check(s) failed`);
  process.exit(1);
}
console.log('workouts checks passed');
