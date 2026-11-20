import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, ChevronRight, Loader2, Play, Plus } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useWorkoutDraft, useWorkouts } from '@/hooks/useWorkouts';
import { closeOnBack } from '@/lib/backButton';
import { cn } from '@/lib/utils';
import { draftFrom, draftFromRoutine, minutesBetween, nextRoutine, nextUp, workoutSummary, type Draft, type Routine, type Workout } from '@/lib/workouts';

const dayParts = (iso: string) => {
  const d = new Date(iso);
  return { wd: d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase(), d: d.getDate() };
};
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

const emptyName = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Morning workout' : h < 17 ? 'Afternoon workout' : 'Evening workout';
};

const Workouts = () => {
  const navigate = useNavigate();
  const [draft, setDraft] = useWorkoutDraft();
  const { byId, workouts, sets, routines, loading, error } = useWorkouts();
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const kindOf = (id: string) => byId.get(id)?.kind;
  useEffect(() => (repeatOpen ? closeOnBack(() => setRepeatOpen(false)) : undefined), [repeatOpen]);
  const setsOf = useMemo(() => {
    const m = new Map<string, typeof sets>();
    for (const s of sets) m.set(s.workout_id, [...(m.get(s.workout_id) ?? []), s]);
    return m;
  }, [sets]);
  // One entry per workout name, newest first, for repeating a past workout.
  const named = useMemo(() => {
    const seen = new Map<string, Workout>();
    for (const w of workouts) if (!seen.has(w.name.trim().toLowerCase())) seen.set(w.name.trim().toLowerCase(), w);
    return [...seen.values()];
  }, [workouts]);

  const start = (d: Draft) => {
    setDraft(d);
    navigate('/workouts/log');
  };
  const startEmpty = () => start({ id: crypto.randomUUID(), name: emptyName(), startedAt: new Date().toISOString(), exercises: [] });
  const repeat = (w: Workout) => start(draftFrom(crypto.randomUUID(), new Date().toISOString(), w.name, setsOf.get(w.id) ?? []));
  const startRoutine = (r: Routine) => start(draftFromRoutine(crypto.randomUUID(), new Date().toISOString(), r));
  const namesOf = (ids: string[]) => [...new Set(ids)].map((id) => byId.get(id)?.name).filter(Boolean) as string[];

  // Next up: the routine after the last one used; with no routines, the past workout done longest ago.
  const routine = nextRoutine(routines, workouts);
  const lastRoutine = routines.find((r) => r.id === workouts.find((w) => routines.some((x) => x.id === w.routine_id))?.routine_id);
  const past = routine ? null : nextUp(workouts);
  const pastSets = past ? setsOf.get(past.id) ?? [] : [];
  const up = routine
    ? {
        name: routine.name,
        after: lastRoutine && lastRoutine.id !== routine.id ? lastRoutine.name : null,
        names: namesOf(routine.items.map((i) => i.exerciseId)),
        meta: `${routine.items.reduce((n, i) => n + i.sets.length, 0)} sets`,
        go: () => startRoutine(routine),
      }
    : past
      ? {
          name: past.name,
          after: workouts[0].id !== past.id ? workouts[0].name : null,
          names: namesOf([...pastSets].sort((a, b) => a.position - b.position).map((s) => s.exercise_id)),
          meta: `${pastSets.length} sets · about ${minutesBetween(past.started_at, past.ended_at)} min last time`,
          go: () => repeat(past),
        }
      : null;

  if (loading && workouts.length === 0 && !draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <div className="flex h-14 items-center gap-1">
        <MenuButton />
        <h1 className="ml-2 flex-1 font-display text-2xl font-semibold tracking-tight">Workouts</h1>
        <Link to="/workouts/stats" aria-label="Workout stats" className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
          <BarChart3 className="h-5 w-5" />
        </Link>
      </div>

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</div>}

      {draft ? (
        <section className="space-y-3 rounded-[28px] bg-chart-fiber/15 p-[18px]">
          <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-chart-fiber">In progress</span>
          <div className="font-display text-[30px] font-bold leading-none">{draft.name}</div>
          <div className="text-[13px] text-muted-foreground">
            Started {minutesBetween(draft.startedAt, new Date().toISOString())} min ago · {draft.exercises.length}{' '}
            {draft.exercises.length === 1 ? 'exercise' : 'exercises'}
          </div>
          <button type="button" onClick={() => navigate('/workouts/log')} className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-chart-fiber text-[17px] font-bold text-background">
            <Play className="h-[18px] w-[18px] fill-current" /> Resume workout
          </button>
          <button
            type="button"
            onClick={() => (discarding ? (setDraft(null), setDiscarding(false)) : setDiscarding(true))}
            className={cn('h-11 w-full rounded-full text-sm font-semibold', discarding ? 'bg-destructive text-destructive-foreground' : 'text-destructive')}
          >
            {discarding ? 'Tap again to discard it' : 'Discard workout'}
          </button>
        </section>
      ) : up ? (
        <>
          <section className="space-y-3 rounded-[28px] bg-chart-fat/15 p-[18px]">
            <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-chart-fat">Next up{up.after ? ` · after ${up.after}` : ''}</span>
            <div className="font-display text-[32px] font-bold leading-none">{up.name}</div>
            {up.names.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {up.names.slice(0, 6).map((n) => (
                  <span key={n} className="rounded-full bg-background px-2.5 py-1.5 text-xs font-semibold">{n}</span>
                ))}
                {up.names.length > 6 && <span className="px-1 py-1.5 text-xs font-semibold text-muted-foreground">+{up.names.length - 6}</span>}
              </div>
            )}
            <div className="text-[13px] text-muted-foreground">
              {up.names.length} {up.names.length === 1 ? 'exercise' : 'exercises'} · {up.meta}
            </div>
            <button type="button" onClick={up.go} className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[17px] font-bold text-primary-foreground">
              <Play className="h-[18px] w-[18px] fill-current" /> Start {up.name}
            </button>
          </section>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={startEmpty} className="h-[52px] rounded-full bg-muted text-sm font-bold">Empty workout</button>
            <button type="button" onClick={() => setRepeatOpen(true)} className="h-[52px] rounded-full bg-muted text-sm font-bold">Routines</button>
          </div>
        </>
      ) : (
        <>
          <section className="space-y-3 rounded-[28px] bg-chart-fat/15 p-[18px]">
            <span className="text-[12px] font-bold uppercase tracking-[0.1em] text-chart-fat">Your first workout</span>
            <div className="font-display text-[28px] font-bold leading-tight">Log sets, reps and weights</div>
            <div className="text-[13px] text-muted-foreground">Pick from 100 exercises or add your own. Next time, the weights you lifted show beside each set.</div>
            <button type="button" onClick={startEmpty} className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-primary text-[17px] font-bold text-primary-foreground">
              <Play className="h-[18px] w-[18px] fill-current" /> Start workout
            </button>
          </section>
          <button type="button" onClick={() => navigate('/workouts/routines/new')} className="h-[52px] w-full rounded-full bg-muted text-sm font-bold">
            Plan a routine
          </button>
        </>
      )}

      {workouts.length > 0 && (
        <>
          <h2 className="pt-1 font-display text-xl font-semibold">Recent</h2>
          <div className="divide-y divide-border overflow-hidden rounded-[20px] bg-card">
            {workouts.slice(0, 10).map((w) => {
              const { wd, d } = dayParts(w.started_at);
              const sum = workoutSummary(setsOf.get(w.id) ?? [], kindOf);
              return (
                <Link key={w.id} to={`/workouts/${w.id}`} className="flex min-h-[60px] items-center gap-3 px-3.5 py-3">
                  <span className="flex w-10 flex-none flex-col items-center">
                    <span className="text-[11px] text-muted-foreground">{wd}</span>
                    <span className="text-lg font-extrabold leading-tight">{d}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-bold">{w.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {minutesBetween(w.started_at, w.ended_at)} min · {sum.sets} sets
                    </span>
                  </span>
                  {sum.volume > 0 && <span className="text-sm font-bold tabular-nums">{Math.round(sum.volume).toLocaleString()} kg</span>}
                </Link>
              );
            })}
          </div>
        </>
      )}

      <Drawer open={repeatOpen} onOpenChange={setRepeatOpen}>
        <DrawerContent className="max-h-[80vh] rounded-t-[26px] border-border bg-card">
          <DrawerTitle className="sr-only">Routines</DrawerTitle>
          <div className="flex min-h-0 flex-col gap-2 overflow-y-auto px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3">
            <div className="flex items-center justify-between pb-1">
              <div className="font-display text-lg font-semibold tracking-tight">Routines</div>
              <button type="button" onClick={() => navigate('/workouts/routines/new')} className="flex h-11 items-center gap-1 rounded-full bg-muted px-3.5 text-sm font-semibold text-primary">
                <Plus className="h-4 w-4" strokeWidth={2.6} /> New
              </button>
            </div>
            {routines.length === 0 && <p className="pb-2 text-sm text-muted-foreground">Save a set list you repeat, like Push, Pull or Legs, and start it in one tap.</p>}
            <div className="divide-y divide-border">
              {routines.map((r) => (
                <div key={r.id} className="flex min-h-14 items-center gap-2">
                  <button type="button" onClick={() => navigate(`/workouts/routines/${r.id}`)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.items.length} {r.items.length === 1 ? 'exercise' : 'exercises'} · Edit
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Start ${r.name}`}
                    onClick={() => {
                      setRepeatOpen(false);
                      startRoutine(r);
                    }}
                    className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground"
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                </div>
              ))}
            </div>
            {named.length > 0 && <div className="pt-3 text-[12px] font-semibold text-muted-foreground">Repeat a past workout</div>}
            <div className="divide-y divide-border">
              {named.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setRepeatOpen(false);
                    repeat(w);
                  }}
                  className="flex min-h-14 w-full items-center gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{w.name}</span>
                    <span className="block text-xs text-muted-foreground">Last done {longDate(w.started_at)}</span>
                  </span>
                  <Play className="h-4 w-4 flex-none fill-current text-primary" />
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Workouts;
