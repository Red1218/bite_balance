import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Loader2, MoreHorizontal, Timer } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useWorkoutDraft, useWorkouts } from '@/hooks/useWorkouts';
import { closeOnBack } from '@/lib/backButton';
import { cancelRestEnd, scheduleRestEnd } from '@/lib/restTimer';
import { cn } from '@/lib/utils';
import {
  DEFAULT_REST, EQUIPMENT_LABEL, KINDS, REST_OPTIONS, SET_TYPES, draftRows, emptySet, fmtSet, fmtTime, lastSetsByExercise, minutesBetween,
  newRecords, restLabel, routineItemsFromDraft, sameItems, setLabels, setValues, toDraftValues, workoutSummary,
  type Draft, type DraftSet, type Exercise, type Field, type Routine, type SetType, type WorkoutSet,
} from '@/lib/workouts';
import ExercisePicker from '@/components/workouts/ExercisePicker';
import { PartTag, Tag } from '@/components/workouts/workoutUi';

const INPUT_MODE: Record<Field, 'decimal' | 'numeric' | 'text'> = { kg: 'decimal', reps: 'numeric', time: 'text', km: 'decimal' };
const PLACEHOLDER: Record<Field, string> = { kg: 'kg', reps: 'reps', time: '0:00', km: 'km' };

const useNow = () => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return now;
};

const Stat = ({ value, label }: { value: string; label: string }) => (
  <span className="flex flex-col">
    <span className="font-display text-[22px] font-bold leading-tight tabular-nums">{value}</span>
    <span className="text-xs text-muted-foreground">{label}</span>
  </span>
);

// Mounted only while open, so Back closes it for as long as it's on screen.
const useCloseOnBack = (onClose: () => void) => useEffect(() => closeOnBack(onClose), []); // eslint-disable-line react-hooks/exhaustive-deps

const SheetShell = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) => {
  useCloseOnBack(onClose);
  return (
  <Drawer open onOpenChange={(open) => !open && onClose()}>
    <DrawerContent className="rounded-t-[26px] border-border bg-card">
      <DrawerTitle className="sr-only">{title}</DrawerTitle>
      <div className="space-y-2 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3">
        <div className="pb-1 font-display text-lg font-semibold tracking-tight">{title}</div>
        {children}
      </div>
    </DrawerContent>
  </Drawer>
  );
};

const SheetButton = ({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) => (
  <button type="button" onClick={onClick} className={cn('flex h-12 w-full items-center gap-3 rounded-2xl bg-muted px-4 text-left text-[15px] font-semibold', danger && 'text-destructive')}>
    {children}
  </button>
);

const WorkoutLog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [draft, setDraft] = useWorkoutDraft();
  const { exercises, byId, workouts, sets, routines, loading, createExercise, saveWorkout, exerciseHistory, saveRoutine } = useWorkouts();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const [typeFor, setTypeFor] = useState<{ ei: number; si: number } | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
  const [restFor, setRestFor] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);

  const previous = useMemo(() => lastSetsByExercise(workouts, sets), [workouts, sets]);
  const kindOf = (id: string) => byId.get(id)?.kind;

  if (!draft) return <Navigate to="/workouts" replace />;
  if (loading && exercises.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const rows = draftRows(draft, kindOf);
  const summary = workoutSummary(rows, kindOf);
  const total = draft.exercises.reduce((n, e) => n + e.sets.length, 0);

  const edit = (fn: (d: Draft) => Draft) => setDraft((d) => (d ? fn(d) : d));
  const editExercise = (ei: number, fn: (sets: DraftSet[]) => DraftSet[]) =>
    edit((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === ei ? { ...e, sets: fn(e.sets) } : e)) }));
  const editSet = (ei: number, si: number, patch: Partial<DraftSet>) => editExercise(ei, (list) => list.map((s, i) => (i === si ? { ...s, ...patch } : s)));

  // Ticking fills empty boxes from last time, like the hints show.
  const tick = (ex: Exercise, ei: number, si: number, s: DraftSet) => {
    if (s.done) return editSet(ei, si, { done: false });
    const prev = previous.get(ex.id)?.[si];
    const hint = prev ? toDraftValues(prev) : null;
    const filled = { ...s, ...Object.fromEntries(KINDS[ex.kind].fields.map((f) => [f, s[f].trim() || hint?.[f] || ''])) };
    if (!setValues(ex.kind, filled)) {
      toast({ title: 'Fill in the set first', description: `Enter ${KINDS[ex.kind].heads.join(' and ').toLowerCase()} to tick it.` });
      return;
    }
    editSet(ei, si, { ...filled, done: true });
    // Rest starts after the set, unless it's off or a drop set follows straight away.
    const de = draft.exercises[ei];
    const rest = de.rest ?? DEFAULT_REST;
    if (!rest || de.sets[si + 1]?.type === 'drop') return;
    startRest(Date.now() + rest * 1000, rest, ex.name);
  };

  const startRest = (endsAt: number, total: number, name: string) => {
    edit((d) => ({ ...d, rest: { endsAt, total } }));
    void scheduleRestEnd(endsAt, name ? `Time for your next set of ${name}.` : 'Time for your next set.');
  };
  const stopRest = () => {
    edit((d) => ({ ...d, rest: null }));
    cancelRestEnd();
  };
  const resting = draft.rest && draft.rest.endsAt > now ? draft.rest : null;

  const addExercises = (ids: string[]) => edit((d) => ({ ...d, exercises: [...d.exercises, ...ids.map((exerciseId) => ({ exerciseId, sets: [emptySet()] }))] }));
  const moveExercise = (ei: number, by: number) =>
    edit((d) => {
      const list = [...d.exercises];
      const [ex] = list.splice(ei, 1);
      list.splice(Math.max(0, Math.min(list.length, ei + by)), 0, ex);
      return { ...d, exercises: list };
    });

  return (
    <div className="-mx-4 -mt-4">
      <header className="sticky z-20 space-y-3 border-b border-border bg-background px-4 pb-3 pt-3" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="flex items-center gap-2.5">
          <button type="button" aria-label="Minimise workout" onClick={() => navigate('/workouts')} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-muted">
            <ChevronDown className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-xl font-bold">{draft.name}</h1>
          <button type="button" onClick={() => setFinishing(true)} className="h-11 rounded-full bg-chart-fiber px-[18px] text-[15px] font-bold text-background">
            Finish
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat value={fmtTime(Math.max(0, (now - Date.parse(draft.startedAt)) / 1000))} label="Duration" />
          <Stat value={`${Math.round(summary.volume).toLocaleString()} kg`} label="Volume" />
          <Stat value={`${summary.sets} / ${total}`} label="Sets" />
        </div>
      </header>

      <div className={cn('space-y-3 px-3 pt-3.5', resting && 'pb-20')}>
        {draft.exercises.map((de, ei) => {
          const ex = byId.get(de.exerciseId);
          if (!ex) return null;
          const { fields, heads } = KINDS[ex.kind];
          const grid = { gridTemplateColumns: `40px minmax(0,1fr) ${fields.map(() => '64px').join(' ')} 44px` };
          const labels = setLabels(de.sets);
          const prev = previous.get(ex.id) ?? [];
          return (
            <section key={`${de.exerciseId}-${ei}`} className="space-y-1 rounded-3xl bg-card px-2 pb-2 pt-3">
              <div className="flex items-center gap-2.5 px-1.5 pb-1.5">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate text-[17px] font-bold text-primary">{ex.name}</div>
                  <div className="flex gap-1.5">
                    <PartTag part={ex.body_part} />
                    <Tag>{EQUIPMENT_LABEL[ex.equipment]}</Tag>
                    <button type="button" onClick={() => setRestFor(ei)} aria-label={`Rest timer for ${ex.name}: ${restLabel(de.rest ?? DEFAULT_REST)}`}>
                      <Tag>
                        <Timer className="-mt-px mr-0.5 inline h-3 w-3" aria-hidden />
                        {restLabel(de.rest ?? DEFAULT_REST)}
                      </Tag>
                    </button>
                  </div>
                </div>
                <button type="button" aria-label={`More for ${ex.name}`} onClick={() => setMenuFor(ei)} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-1.5 px-1.5 text-[11px] font-bold tracking-[0.06em] text-muted-foreground" style={grid}>
                <span className="text-center">SET</span>
                <span>PREVIOUS</span>
                {heads.map((h) => (
                  <span key={h} className="text-center">{h}</span>
                ))}
                <span />
              </div>
              {de.sets.map((s, si) => {
                const hint = prev[si] ? toDraftValues(prev[si]) : null;
                const typeTint = s.type === 'warmup' ? 'bg-chart-carbs/20 text-chart-carbs' : s.type === 'failure' ? 'bg-primary/15 text-primary' : s.type === 'drop' ? 'bg-chart-water/20 text-chart-water' : '';
                return (
                  <div key={si} className={cn('grid items-center gap-1.5 rounded-[14px] px-1.5 py-1 transition-colors', s.done && 'bg-chart-fiber/15')} style={grid}>
                    <button type="button" aria-label={`Set ${labels[si]} type`} onClick={() => setTypeFor({ ei, si })} className={cn('h-9 rounded-[10px] text-sm font-extrabold', typeTint)}>
                      {labels[si]}
                    </button>
                    <span className="truncate text-[13px] text-muted-foreground">{prev[si] ? fmtSet(ex.kind, prev[si]) : '—'}</span>
                    {fields.map((f) => (
                        <input
                          key={f}
                          aria-label={`Set ${labels[si]} ${f}`}
                          inputMode={INPUT_MODE[f]}
                          value={s[f]}
                          placeholder={hint?.[f] || PLACEHOLDER[f]}
                          onChange={(e) => editSet(ei, si, { [f]: e.target.value })}
                          className={cn(
                            'h-9 w-full min-w-0 rounded-[10px] text-center text-[15px] font-bold outline-none placeholder:font-semibold placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-ring',
                            s.done ? 'bg-transparent text-chart-fiber' : 'bg-muted'
                          )}
                        />
                    ))}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={s.done}
                      aria-label={`Set ${labels[si]} done`}
                      onClick={() => tick(ex, ei, si, s)}
                      className={cn('flex h-11 w-11 items-center justify-center justify-self-end rounded-xl', s.done ? 'bg-chart-fiber text-background' : 'bg-muted text-muted-foreground')}
                    >
                      <Check className="h-[18px] w-[18px]" strokeWidth={3} />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={() => editExercise(ei, (list) => [...list, emptySet()])} className="mt-1 h-11 w-full rounded-[14px] bg-muted text-sm font-bold">
                + Add set
              </button>
            </section>
          );
        })}

        <button type="button" onClick={() => setPicking(true)} className="h-[52px] w-full rounded-full border-[1.5px] border-dashed border-primary text-[15px] font-bold text-primary">
          + Add exercise
        </button>
        {draft.exercises.length === 0 && <p className="px-2 text-center text-sm text-muted-foreground">Add your first exercise to start logging sets.</p>}
      </div>

      {resting && (
        <RestPill
          left={Math.ceil((resting.endsAt - now) / 1000)}
          total={resting.total}
          onAdd={() => startRest(resting.endsAt + 15000, resting.total + 15, '')}
          onSkip={stopRest}
        />
      )}

      <ExercisePicker open={picking} exercises={exercises} onOpenChange={setPicking} onAdd={addExercises} onCreate={createExercise} />

      {typeFor && (
        <SheetShell title={`Set ${setLabels(draft.exercises[typeFor.ei].sets)[typeFor.si]}`} onClose={() => setTypeFor(null)}>
          {SET_TYPES.map(([t, label, k]) => (
            <SheetButton
              key={t}
              onClick={() => {
                editSet(typeFor.ei, typeFor.si, { type: t as SetType });
                setTypeFor(null);
              }}
            >
              <span className="w-6 text-center font-extrabold">{k || '#'}</span>
              <span className="flex-1">{label}</span>
              {draft.exercises[typeFor.ei].sets[typeFor.si].type === t && <Check className="h-4 w-4" />}
            </SheetButton>
          ))}
          <SheetButton
            danger
            onClick={() => {
              editExercise(typeFor.ei, (list) => list.filter((_, i) => i !== typeFor.si));
              setTypeFor(null);
            }}
          >
            Delete set
          </SheetButton>
        </SheetShell>
      )}

      {menuFor !== null && (
        <SheetShell title={byId.get(draft.exercises[menuFor].exerciseId)?.name ?? 'Exercise'} onClose={() => setMenuFor(null)}>
          <SheetButton onClick={() => (setRestFor(menuFor), setMenuFor(null))}>
            <Timer className="h-4 w-4" /> <span className="flex-1">Rest timer</span>
            <span className="text-muted-foreground">{restLabel(draft.exercises[menuFor].rest ?? DEFAULT_REST)}</span>
          </SheetButton>
          {menuFor > 0 && <SheetButton onClick={() => (moveExercise(menuFor, -1), setMenuFor(null))}>Move up</SheetButton>}
          {menuFor < draft.exercises.length - 1 && <SheetButton onClick={() => (moveExercise(menuFor, 1), setMenuFor(null))}>Move down</SheetButton>}
          <SheetButton
            danger
            onClick={() => {
              edit((d) => ({ ...d, exercises: d.exercises.filter((_, i) => i !== menuFor) }));
              setMenuFor(null);
            }}
          >
            Remove exercise
          </SheetButton>
        </SheetShell>
      )}

      {restFor !== null && (
        <SheetShell title={`Rest after each set of ${byId.get(draft.exercises[restFor].exerciseId)?.name ?? 'this exercise'}`} onClose={() => setRestFor(null)}>
          <div className="grid grid-cols-3 gap-2">
            {REST_OPTIONS.map((secs) => {
              const on = (draft.exercises[restFor].rest ?? DEFAULT_REST) === secs;
              return (
                <button
                  key={secs}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    edit((d) => ({ ...d, exercises: d.exercises.map((e, i) => (i === restFor ? { ...e, rest: secs } : e)) }));
                    setRestFor(null);
                  }}
                  className={cn('h-12 rounded-2xl text-[15px] font-bold tabular-nums', on ? 'bg-foreground text-background' : 'bg-muted')}
                >
                  {restLabel(secs)}
                </button>
              );
            })}
          </div>
        </SheetShell>
      )}

      {finishing && (
        <FinishSheet
          draft={draft}
          rows={rows}
          summary={summary}
          routine={routines.find((r) => r.id === draft.routineId) ?? null}
          nameOf={(id) => byId.get(id)?.name ?? ''}
          kindOf={kindOf}
          loadHistory={exerciseHistory}
          onClose={() => setFinishing(false)}
          onDiscard={() => {
            cancelRestEnd();
            setDraft(null);
            navigate('/workouts');
          }}
          onSave={async (name, note, keepRoutine) => {
            const routine = routines.find((r) => r.id === draft.routineId) ?? null;
            const items = routineItemsFromDraft(draft, rows);
            // A new routine is made first, so the workout can point at it.
            let routineId = routine?.id ?? null;
            if (keepRoutine && !routine) routineId = (await saveRoutine({ name, items }))?.id ?? null;
            const workout = { id: draft.id, name, started_at: draft.startedAt, ended_at: new Date().toISOString(), note, routine_id: routineId };
            if (!(await saveWorkout(workout, rows))) return;
            if (keepRoutine && routine) await saveRoutine({ name: routine.name, items }, routine.id);
            cancelRestEnd();
            setDraft(null);
            navigate(`/workouts/${draft.id}`, { replace: true });
          }}
        />
      )}
    </div>
  );
};

// The countdown between sets, floating above the bottom bar. The phone notification covers the app being closed.
const RestPill = ({ left, total, onAdd, onSkip }: { left: number; total: number; onAdd: () => void; onSkip: () => void }) => {
  const ring = 2 * Math.PI * 20;
  return (
    <div
      role="timer"
      aria-label={`Rest, ${fmtTime(left)} left`}
      className="fixed inset-x-4 z-30 mx-auto flex h-16 max-w-[528px] items-center gap-2.5 rounded-full bg-black pl-2.5 pr-2 text-white shadow-[0_14px_34px_rgba(0,0,0,.5)]"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}
    >
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden className="flex-none -rotate-90 text-chart-carbs">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
        <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(left / total) * ring} ${ring}`} />
      </svg>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-display text-[22px] font-bold leading-none tabular-nums">{fmtTime(left)}</span>
        <span className="text-xs text-white/65">Rest · of {fmtTime(total)}</span>
      </span>
      <button type="button" onClick={onAdd} className="h-11 rounded-full bg-white/[.12] px-3.5 text-sm font-bold">+15s</button>
      <button type="button" onClick={onSkip} className="h-11 rounded-full bg-white/[.12] px-3.5 text-sm font-bold">Skip</button>
    </div>
  );
};

interface FinishSheetProps {
  draft: Draft;
  rows: WorkoutSet[];
  summary: { sets: number; volume: number };
  routine: Routine | null;
  nameOf: (exerciseId: string) => string;
  kindOf: (exerciseId: string) => Exercise['kind'] | undefined;
  loadHistory: (exerciseIds: string[]) => Promise<WorkoutSet[]>;
  onClose: () => void;
  onDiscard: () => void;
  onSave: (name: string, note: string | null, keepRoutine: boolean) => Promise<void>;
}

const FinishSheet = ({ draft, rows, summary, routine, nameOf, kindOf, loadHistory, onClose, onDiscard, onSave }: FinishSheetProps) => {
  const [name, setName] = useState(draft.name);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [keepRoutine, setKeepRoutine] = useState(false);
  const [records, setRecords] = useState<ReturnType<typeof newRecords>>([]);
  const minutes = minutesBetween(draft.startedAt, new Date().toISOString());
  const changed = routine ? !sameItems(routine.items, routineItemsFromDraft(draft, rows)) : true;
  useCloseOnBack(onClose);

  // Records against every earlier set of these exercises, fetched once (this workout isn't saved yet).
  useEffect(() => {
    let live = true;
    loadHistory([...new Set(rows.map((r) => r.exercise_id))]).then((history) => live && setRecords(newRecords(rows, history, kindOf)));
    return () => {
      live = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh] rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">Finish workout</DrawerTitle>
        <div className="space-y-3.5 overflow-y-auto px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3">
          <div className="font-display text-xl font-semibold tracking-tight">Finish workout</div>
          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-muted-foreground">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-12 text-base" />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              [`${minutes} min`, 'Duration'],
              [Math.round(summary.volume).toLocaleString(), 'kg volume'],
              [String(summary.sets), 'Sets'],
            ].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-muted p-3">
                <div className="font-display text-xl font-bold">{v}</div>
                <div className="text-xs text-muted-foreground">{l}</div>
              </div>
            ))}
          </div>
          {summary.sets === 0 && <p className="text-sm text-muted-foreground">Tick at least one set to save this workout.</p>}
          {records.length > 0 && (
            <div className="space-y-2">
              <div className="text-[12px] font-semibold text-muted-foreground">New records</div>
              {records.map((r) => (
                <div key={r.exerciseId + r.label} className="flex items-center gap-2.5 rounded-2xl bg-chart-carbs/15 px-3 py-2.5">
                  <span className="rounded-lg bg-chart-carbs px-2 py-1 text-[11px] font-extrabold text-background">PR</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{nameOf(r.exerciseId)}</span>
                  <span className="text-[13px] font-bold text-chart-carbs">
                    {r.label} {r.value}
                  </span>
                </div>
              ))}
            </div>
          )}
          {summary.sets > 0 && changed && (
            <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-muted px-4 py-2">
              <span className="flex-1 text-sm font-semibold">{routine ? `Update “${routine.name}” with today's exercises and sets` : 'Save as a routine'}</span>
              <Switch checked={keepRoutine} onCheckedChange={setKeepRoutine} />
            </label>
          )}
          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-muted-foreground">Note</span>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} className="resize-none text-base" />
          </label>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <button type="button" onClick={onClose} className="h-14 rounded-full bg-muted text-[15px] font-semibold">Keep going</button>
            <button
              type="button"
              disabled={!name.trim() || summary.sets === 0 || saving}
              onClick={async () => {
                setSaving(true);
                await onSave(name.trim(), note.trim() || null, keepRoutine && changed);
                setSaving(false);
              }}
              className="h-14 rounded-full bg-chart-fiber text-base font-bold text-background disabled:opacity-50"
            >
              Save workout
            </button>
          </div>
          <button
            type="button"
            onClick={() => (discarding ? onDiscard() : setDiscarding(true))}
            className={cn('h-11 w-full rounded-full text-sm font-semibold', discarding ? 'bg-destructive text-destructive-foreground' : 'text-destructive')}
          >
            {discarding ? 'Tap again to discard this workout' : 'Discard workout'}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default WorkoutLog;
