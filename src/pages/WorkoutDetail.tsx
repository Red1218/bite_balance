import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Play } from 'lucide-react';
import { useWorkoutDraft, useWorkouts } from '@/hooks/useWorkouts';
import { cn } from '@/lib/utils';
import { EQUIPMENT_LABEL, draftFrom, fmtSet, minutesBetween, routineItemsFromSets, setLabels, workoutSummary } from '@/lib/workouts';
import { PartTag, Tag } from '@/components/workouts/workoutUi';

const WorkoutDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useWorkoutDraft();
  const { byId, workouts, sets, routines, loading, deleteWorkout, saveRoutine } = useWorkouts();
  const [confirming, setConfirming] = useState(false);

  const workout = workouts.find((w) => w.id === id);
  if (loading && !workout) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!workout) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">This workout isn't here any more.</p>
        <button type="button" onClick={() => navigate('/workouts')} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Back to workouts
        </button>
      </div>
    );
  }

  const mine = sets.filter((s) => s.workout_id === workout.id).sort((a, b) => a.position - b.position || a.set_no - b.set_no);
  const groups = [...new Set(mine.map((s) => s.position))].map((p) => mine.filter((s) => s.position === p));
  const sum = workoutSummary(mine, (eid) => byId.get(eid)?.kind);
  const started = new Date(workout.started_at);

  return (
    <div className="space-y-3.5">
      <div className="flex h-14 items-center gap-1">
        <button type="button" aria-label="Back to workouts" onClick={() => navigate('/workouts')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold tracking-tight">{workout.name}</h1>
      </div>
      <p className="-mt-2 px-1 text-sm text-muted-foreground">
        {started.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
        {started.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {[
          [`${minutesBetween(workout.started_at, workout.ended_at)} min`, 'Duration'],
          [Math.round(sum.volume).toLocaleString(), 'kg volume'],
          [String(sum.sets), 'Sets'],
        ].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-card p-3">
            <div className="font-display text-xl font-bold">{v}</div>
            <div className="text-xs text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>

      {workout.note && <p className="whitespace-pre-wrap rounded-2xl bg-card p-3.5 text-[15px]">{workout.note}</p>}

      {groups.map((list) => {
        const ex = byId.get(list[0].exercise_id);
        if (!ex) return null;
        const labels = setLabels(list.map((s) => ({ type: s.set_type })));
        return (
          <section key={list[0].position} className="space-y-2 rounded-3xl bg-card p-3.5">
            <div className="space-y-1">
              <div className="text-[17px] font-bold text-primary">{ex.name}</div>
              <div className="flex gap-1.5">
                <PartTag part={ex.body_part} />
                <Tag>{EQUIPMENT_LABEL[ex.equipment]}</Tag>
              </div>
            </div>
            {list.map((s, i) => (
              <div key={s.set_no} className="flex items-center gap-3 text-[15px]">
                <span className="w-6 text-center text-sm font-extrabold text-muted-foreground">{labels[i]}</span>
                <span className="font-semibold tabular-nums">{fmtSet(ex.kind, s)}</span>
              </div>
            ))}
          </section>
        );
      })}

      {!draft && (
        <button
          type="button"
          onClick={() => {
            setDraft(draftFrom(crypto.randomUUID(), new Date().toISOString(), workout.name, mine));
            navigate('/workouts/log');
          }}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-primary text-base font-bold text-primary-foreground"
        >
          <Play className="h-[18px] w-[18px] fill-current" /> Repeat this workout
        </button>
      )}
      {!routines.some((r) => r.id === workout.routine_id) && (
        <button
          type="button"
          onClick={async () => {
            const saved = await saveRoutine({ name: workout.name, items: routineItemsFromSets(mine) });
            if (saved) navigate(`/workouts/routines/${saved.id}`);
          }}
          className="h-12 w-full rounded-full bg-muted text-sm font-bold"
        >
          Save as a routine
        </button>
      )}
      <button
        type="button"
        onClick={async () => {
          if (!confirming) return setConfirming(true);
          if (await deleteWorkout(workout.id)) navigate('/workouts', { replace: true });
        }}
        onBlur={() => setConfirming(false)}
        className={cn('h-12 w-full rounded-full text-sm font-semibold', confirming ? 'bg-destructive text-destructive-foreground' : 'text-destructive')}
      >
        {confirming ? 'Tap again to delete this workout' : 'Delete workout'}
      </button>
    </div>
  );
};

export default WorkoutDetail;
