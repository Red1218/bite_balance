import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Loader2, Pencil } from 'lucide-react';
import { EditExerciseSheet } from '@/components/workouts/ExercisePicker';
import { useExerciseHistory, useWorkouts } from '@/hooks/useWorkouts';
import { BODY_PART_LABEL, EQUIPMENT_LABEL, chartMetric, exerciseBests, exerciseTrend, fmtSet, setLabels, workoutSummary } from '@/lib/workouts';

const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const longDay = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

// Best result per session over time. Labels the lowest and highest values and the first and last dates.
const TrendChart = ({ points, show, label }: { points: { at: string; value: number }[]; show: (v: number) => string; label: string }) => {
  const W = 330;
  const H = 150;
  const left = 46;
  const top = 16;
  const bottom = 126;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const span = max - min || 1;
  const x = (i: number) => left + 6 + (i * (W - left - 14)) / Math.max(1, points.length - 1);
  const y = (v: number) => (max === min ? (top + bottom) / 2 : bottom - ((v - min) / span) * (bottom - top));
  const last = points[points.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      role="img"
      aria-label={`${label} went from ${show(points[0].value)} on ${shortDay(points[0].at)} to ${show(last.value)} on ${shortDay(last.at)}`}
      className="text-chart-steps"
    >
      {[max, min].map((v) => (
        <g key={v}>
          <line x1={left} x2={W} y1={y(v)} y2={y(v)} className="stroke-border" />
          <text x={0} y={y(v) + 4} className="fill-muted-foreground text-[11px]">
            {show(v)}
          </text>
        </g>
      ))}
      <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={p.at} cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 5 : 3} fill="currentColor" />
      ))}
      <text x={left} y={H - 4} className="fill-muted-foreground text-[11px]">
        {shortDay(points[0].at)}
      </text>
      <text x={W} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
        {shortDay(last.at)}
      </text>
    </svg>
  );
};

// One exercise's records, progress and every session it was done in.
const WorkoutExercise = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { byId, loading: loadingList, updateExercise } = useWorkouts();
  const { sessions, loading, error } = useExerciseHistory(id);
  const ex = id ? byId.get(id) : undefined;
  const [editing, setEditing] = useState(false);

  if ((loading || loadingList) && !ex) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!ex) {
    return (
      <div className="space-y-4 py-16 text-center">
        <p className="text-muted-foreground">This exercise isn't here any more.</p>
        <button type="button" onClick={() => navigate('/workouts')} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Back to workouts
        </button>
      </div>
    );
  }

  const bests = exerciseBests(ex.kind, sessions);
  const trend = exerciseTrend(ex.kind, sessions);
  const [chartLabel, , chartShow] = chartMetric(ex.kind);
  const tiles = [...bests.slice(0, 2), { label: 'Sessions', value: String(sessions.length), at: '', set: null }].slice(0, 3);
  if (ex.kind === 'weight_reps' && bests[2]) tiles[2] = bests[2];

  return (
    <div className="space-y-3.5">
      <div className="flex min-h-14 items-center gap-1">
        <button type="button" aria-label="Back" onClick={() => navigate(-1)} className="-ml-2 flex h-11 w-11 flex-none items-center justify-center rounded-full">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{ex.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {[BODY_PART_LABEL[ex.body_part], ex.secondary.map((p) => BODY_PART_LABEL[p]).join(', '), EQUIPMENT_LABEL[ex.equipment]].filter(Boolean).join(' · ')}
          </p>
        </div>
        <button type="button" aria-label={`Edit ${ex.name}`} onClick={() => setEditing(true)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-muted">
          <Pencil className="h-[18px] w-[18px]" />
        </button>
      </div>
      {editing && <EditExerciseSheet exercise={ex} onClose={() => setEditing(false)} onSave={(values) => updateExercise(ex, values)} />}

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">Could not load this exercise's history.</div>}
      {loading && !sessions.length ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : !sessions.length ? (
        <p className="rounded-2xl bg-card p-4 text-sm text-muted-foreground">You haven't logged {ex.name} yet. Your records and progress show here once you do.</p>
      ) : (
        <>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
            {tiles.map((t) => (
              <div key={t.label} className="min-w-0 space-y-1 rounded-[18px] bg-card p-3">
                <div className="truncate text-[11px] font-bold text-muted-foreground">{t.label}</div>
                <div className="truncate font-display text-xl font-bold leading-none tabular-nums">{t.value}</div>
                {t.at && <div className="truncate text-[11px] text-muted-foreground">{t.set && ex.kind !== 'duration' ? fmtSet(ex.kind, t.set) : shortDay(t.at)}</div>}
              </div>
            ))}
          </div>

          <section className="space-y-2 rounded-[22px] bg-card p-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">{chartLabel}</h2>
              <span className="text-xs text-muted-foreground">{trend.length} {trend.length === 1 ? 'session' : 'sessions'}</span>
            </div>
            {trend.length >= 2 ? (
              <TrendChart points={trend} show={chartShow} label={chartLabel} />
            ) : (
              <p className="py-4 text-sm text-muted-foreground">Log it once more to see a trend.</p>
            )}
          </section>

          <h2 className="pt-1 font-display text-lg font-semibold">History</h2>
          {sessions.map((s) => {
            const labels = setLabels(s.sets.map((x) => ({ type: x.set_type })));
            const vol = workoutSummary(s.sets, () => ex.kind).volume;
            return (
              <button key={s.workoutId} type="button" onClick={() => navigate(`/workouts/${s.workoutId}`)} className="w-full space-y-1.5 rounded-[18px] bg-card px-3.5 py-3 text-left">
                <div className="flex justify-between">
                  <span className="text-sm font-bold">{longDay(s.startedAt)}</span>
                  {vol > 0 && <span className="text-xs text-muted-foreground tabular-nums">{Math.round(vol).toLocaleString()} kg</span>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {s.sets.map((set, i) => (
                    <span key={i} className="rounded-[10px] bg-muted px-2 py-1 text-xs font-semibold tabular-nums text-foreground/85">
                      {/^\d+$/.test(labels[i]) ? '' : `${labels[i]} `}
                      {fmtSet(ex.kind, set)}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </>
      )}
    </div>
  );
};

export default WorkoutExercise;
