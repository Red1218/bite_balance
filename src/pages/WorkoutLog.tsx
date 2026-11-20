import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Check, ChevronDown, Loader2, MoreHorizontal } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useWorkoutDraft, useWorkouts } from '@/hooks/useWorkouts';
import { closeOnBack } from '@/lib/backButton';
import { cn } from '@/lib/utils';
import {
  EQUIPMENT_LABEL, KINDS, SET_TYPES, draftRows, emptySet, fmtSet, fmtTime, lastSetsByExercise, minutesBetween, setLabels, setValues,
  toDraftValues, workoutSummary, type Draft, type DraftSet, type Exercise, type Field, type SetType,
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
  const { exercises, byId, workouts, sets, loading, createExercise, saveWorkout } = useWorkouts();
  const now = useNow();
  const [picking, setPicking] = useState(false);
  const [typeFor, setTypeFor] = useState<{ ei: number; si: number } | null>(null);
  const [menuFor, setMenuFor] = useState<number | null>(null);
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
  };

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

      <div className="space-y-3 px-3 pt-3.5">
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

      {finishing && (
        <FinishSheet
          draft={draft}
          summary={summary}
          onClose={() => setFinishing(false)}
          onDiscard={() => {
            setDraft(null);
            navigate('/workouts');
          }}
          onSave={async (name, note) => {
            const workout = { id: draft.id, name, started_at: draft.startedAt, ended_at: new Date().toISOString(), note };
            if (!(await saveWorkout(workout, rows))) return;
            setDraft(null);
            navigate(`/workouts/${draft.id}`, { replace: true });
          }}
        />
      )}
    </div>
  );
};

interface FinishSheetProps {
  draft: Draft;
  summary: { sets: number; volume: number };
  onClose: () => void;
  onDiscard: () => void;
  onSave: (name: string, note: string | null) => Promise<void>;
}

const FinishSheet = ({ draft, summary, onClose, onDiscard, onSave }: FinishSheetProps) => {
  const [name, setName] = useState(draft.name);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const minutes = minutesBetween(draft.startedAt, new Date().toISOString());
  useCloseOnBack(onClose);

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
                await onSave(name.trim(), note.trim() || null);
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
