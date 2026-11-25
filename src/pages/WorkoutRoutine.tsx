import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, ChevronLeft, ChevronUp, Loader2, Minus, Plus, Timer, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useWorkouts } from '@/hooks/useWorkouts';
import { cn } from '@/lib/utils';
import { DEFAULT_REST, EQUIPMENT_LABEL, REST_OPTIONS, restLabel, type RoutineItem } from '@/lib/workouts';
import ExercisePicker from '@/components/workouts/ExercisePicker';
import { PartTag, Tag } from '@/components/workouts/workoutUi';

const MAX_SETS = 20;

// Create or edit a routine: its name and, per exercise, how many sets and the rest between them.
const WorkoutRoutine = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exercises, byId, routines, loading, saveExercise, saveRoutine, deleteRoutine } = useWorkouts();
  const existing = routines.find((r) => r.id === id) ?? null;
  const [name, setName] = useState('');
  const [items, setItems] = useState<RoutineItem[]>([]);
  const [filled, setFilled] = useState(false);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Start from the saved routine once it has loaded.
  useEffect(() => {
    if (filled || !existing) return;
    setName(existing.name);
    setItems(existing.items);
    setFilled(true);
  }, [existing, filled]);

  if (loading && !exercises.length) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (id !== 'new' && !existing) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">This routine isn't here any more.</p>
        <button type="button" onClick={() => navigate('/workouts')} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Back to workouts
        </button>
      </div>
    );
  }

  const change = (i: number, patch: Partial<RoutineItem>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const move = (i: number, by: number) =>
    setItems((prev) => {
      const list = [...prev];
      const [it] = list.splice(i, 1);
      list.splice(i + by, 0, it);
      return list;
    });

  const save = async () => {
    setSaving(true);
    const saved = await saveRoutine({ name, items }, existing?.id);
    setSaving(false);
    if (saved) navigate('/workouts');
  };

  return (
    <div className="space-y-3.5">
      <div className="flex h-14 items-center gap-1">
        <button type="button" aria-label="Back to workouts" onClick={() => navigate('/workouts')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 font-display text-2xl font-semibold tracking-tight">{existing ? 'Edit routine' : 'New routine'}</h1>
        <button
          type="button"
          disabled={!name.trim() || !items.length || saving}
          onClick={save}
          className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Save
        </button>
      </div>

      <label className="block space-y-2">
        <span className="block text-[12px] font-semibold text-muted-foreground">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Push Day" className="h-12 text-base" />
      </label>

      {items.map((it, i) => {
        const ex = byId.get(it.exerciseId);
        if (!ex) return null;
        return (
          <section key={`${it.exerciseId}-${i}`} className="space-y-2.5 rounded-3xl bg-card p-3">
            <div className="flex items-start gap-1">
              <div className="min-w-0 flex-1 space-y-1 pl-1">
                <div className="truncate text-[17px] font-bold text-primary">{ex.name}</div>
                <div className="flex gap-1.5">
                  <PartTag part={ex.body_part} />
                  <Tag>{EQUIPMENT_LABEL[ex.equipment]}</Tag>
                </div>
              </div>
              <button type="button" aria-label={`Move ${ex.name} up`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground disabled:opacity-30">
                <ChevronUp className="h-5 w-5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${ex.name} down`}
                disabled={i === items.length - 1}
                onClick={() => move(i, 1)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground disabled:opacity-30"
              >
                <ChevronDown className="h-5 w-5" />
              </button>
              <button type="button" aria-label={`Remove ${ex.name}`} onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center rounded-full bg-muted">
                <button
                  type="button"
                  aria-label={`One set fewer of ${ex.name}`}
                  disabled={it.sets.length <= 1}
                  onClick={() => change(i, { sets: it.sets.slice(0, -1) })}
                  className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-16 text-center text-sm font-bold tabular-nums">
                  {it.sets.length} {it.sets.length === 1 ? 'set' : 'sets'}
                </span>
                <button
                  type="button"
                  aria-label={`One more set of ${ex.name}`}
                  disabled={it.sets.length >= MAX_SETS}
                  onClick={() => change(i, { sets: [...it.sets, 'normal'] })}
                  className="flex h-11 w-11 items-center justify-center disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </span>
              <button
                type="button"
                aria-label={`Rest for ${ex.name}: ${restLabel(it.rest)}. Tap to change`}
                onClick={() => change(i, { rest: REST_OPTIONS[(REST_OPTIONS.indexOf(it.rest) + 1) % REST_OPTIONS.length] })}
                className="flex h-11 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-bold tabular-nums"
              >
                <Timer className="h-4 w-4 text-muted-foreground" /> Rest {restLabel(it.rest)}
              </button>
            </div>
          </section>
        );
      })}

      <button type="button" onClick={() => setPicking(true)} className="h-[52px] w-full rounded-full border-[1.5px] border-dashed border-primary text-[15px] font-bold text-primary">
        + Add exercise
      </button>

      {existing && (
        <button
          type="button"
          onClick={async () => {
            if (!confirming) return setConfirming(true);
            if (await deleteRoutine(existing.id)) navigate('/workouts', { replace: true });
          }}
          onBlur={() => setConfirming(false)}
          className={cn('h-12 w-full rounded-full text-sm font-semibold', confirming ? 'bg-destructive text-destructive-foreground' : 'text-destructive')}
        >
          {confirming ? 'Tap again to delete this routine' : 'Delete routine'}
        </button>
      )}

      <ExercisePicker
        open={picking}
        exercises={exercises}
        onOpenChange={setPicking}
        onAdd={(ids) => setItems((prev) => [...prev, ...ids.map((exerciseId) => ({ exerciseId, sets: ['normal', 'normal', 'normal'] as RoutineItem['sets'], rest: DEFAULT_REST }))])}
        onCreate={saveExercise}
      />
    </div>
  );
};

export default WorkoutRoutine;
