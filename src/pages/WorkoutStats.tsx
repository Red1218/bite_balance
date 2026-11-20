import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import Segmented from '@/components/Segmented';
import { useLocalToday } from '@/hooks/useHabits';
import { useWorkoutHistory, useWorkouts } from '@/hooks/useWorkouts';
import { cn } from '@/lib/utils';
import { BODY_PART_LABEL, STREAK_MIN, calendarWeeks, periodRange, weekStreak, workoutStats, type Period, type Workout } from '@/lib/workouts';
import { partStyle } from '@/components/workouts/workoutUi';

const PERIOD_NAME: Record<Period, string> = { week: 'week', month: '30 days', year: 'year' };

const fmtKg = (kg: number) => (kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${Math.round(kg)} kg`);
const fmtHours = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}` : `${min} min`);

const Tile = ({ label, value, note, up }: { label: string; value: string; note: string; up?: boolean }) => (
  <div className="space-y-1 rounded-[20px] bg-card p-3.5">
    <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
    <div className="font-display text-[26px] font-bold leading-none tabular-nums">{value}</div>
    <div className={cn('text-xs font-semibold', up === undefined ? 'text-muted-foreground' : up ? 'text-chart-fiber' : 'text-muted-foreground')}>{note}</div>
  </div>
);

const Spark = ({ points }: { points: number[] }) => {
  if (points.length < 2) return <span className="w-16" aria-hidden />;
  const min = Math.min(...points);
  const span = Math.max(...points) - min || 1;
  const xy = points.map((p, i) => `${2 + (i * 60) / (points.length - 1)},${22 - ((p - min) / span) * 18}`).join(' ');
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" aria-hidden className="flex-none text-chart-steps">
      <polyline points={xy} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const WorkoutStats = () => {
  const navigate = useNavigate();
  const today = useLocalToday(); // re-runs the ranges when the day changes
  const [period, setPeriod] = useState<Period>('month');
  const { byId } = useWorkouts();
  const since = useMemo(() => periodRange('year', Date.now()).prevStart, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  const { workouts, sets, loading, error } = useWorkoutHistory(since);

  const st = useMemo(() => workoutStats(period, Date.now(), workouts, sets, byId), [period, workouts, sets, byId, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const name = PERIOD_NAME[period];
  const diff = st.workouts - st.prevWorkouts;
  const volChange = st.prevVolume ? Math.round(((st.volume - st.prevVolume) / st.prevVolume) * 100) : null;
  const maxBar = Math.max(...st.buckets.map((b) => b.volume), 1);
  const tonnes = maxBar >= 1000;
  const maxPart = st.parts[0]?.[1] ?? 1;

  return (
    <div className="space-y-3.5">
      <div className="flex h-14 items-center gap-1">
        <button type="button" aria-label="Back to workouts" onClick={() => navigate('/workouts')} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="flex-1 font-display text-2xl font-semibold tracking-tight">Stats</h1>
      </div>

      <Segmented label="Period" options={[['week', 'Week'], ['month', '30 days'], ['year', 'Year']]} value={period} onChange={setPeriod} />

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">Could not load your stats.</div>}
      {loading && workouts.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Tile
              label="Workouts"
              value={String(st.workouts)}
              up={diff > 0}
              note={diff === 0 ? `Same as the ${name} before` : `${diff > 0 ? '+' : '−'}${Math.abs(diff)} on the ${name} before`}
            />
            <Tile label="Time" value={fmtHours(st.minutes)} note={st.workouts ? `About ${Math.round(st.minutes / st.workouts)} min each` : 'No workouts yet'} />
            <Tile
              label="Volume"
              value={fmtKg(st.volume)}
              up={volChange !== null && volChange > 0}
              note={volChange === null ? `Nothing the ${name} before` : `${volChange >= 0 ? '+' : '−'}${Math.abs(volChange)}% on the ${name} before`}
            />
            <Tile label="Sets" value={String(st.sets)} note={st.workouts ? `${Math.round(st.sets / st.workouts)} a workout` : '—'} />
          </div>

          <section className="space-y-2.5 rounded-3xl bg-card p-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">Volume per {period === 'week' ? 'day' : period === 'month' ? 'week' : 'month'}</h2>
              <span className="text-xs text-muted-foreground">{tonnes ? 'tonnes' : 'kg'}</span>
            </div>
            <div className="flex h-[150px] items-end gap-1.5">
              {st.buckets.map((b) => (
                <div key={b.start} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5 self-stretch">
                  {b.volume > 0 && (
                    <span className={cn('text-[11px] font-bold tabular-nums', b.current && 'text-chart-steps')}>
                      {tonnes ? (b.volume / 1000).toFixed(1) : Math.round(b.volume)}
                    </span>
                  )}
                  <span
                    className={cn('w-full rounded-t-[8px] rounded-b-[3px]', b.current ? 'border-2 border-dashed border-chart-steps' : 'bg-chart-steps')}
                    style={{ height: `${Math.max(b.volume ? 4 : 2, (b.volume / maxBar) * 110)}px`, opacity: b.volume || b.current ? 1 : 0.25 }}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-1.5">
              {st.buckets.map((b) => (
                <span key={b.start} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
                  {period === 'year' ? b.label[0] : b.label}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-3xl bg-card p-3.5">
            <h2 className="pb-1.5 text-[15px] font-bold">Top lifts · est. 1RM</h2>
            {st.lifts.length === 0 && <p className="py-2 text-sm text-muted-foreground">Log weighted sets to see your estimated one-rep max.</p>}
            <div className="divide-y divide-border">
              {st.lifts.map((l) => (
                <Link key={l.exerciseId} to={`/workouts/exercises/${l.exerciseId}`} className="flex min-h-[52px] items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{l.name}</span>
                  <Spark points={l.points} />
                  <span className="flex w-[78px] flex-none flex-col items-end">
                    <span className="text-[15px] font-extrabold tabular-nums">{Math.round(l.best)} kg</span>
                    {l.change !== null && Math.round(l.change) !== 0 && (
                      <span className={cn('text-[11px] font-bold', l.change > 0 ? 'text-chart-fiber' : 'text-muted-foreground')}>
                        {l.change > 0 ? '+' : '−'}
                        {Math.abs(Math.round(l.change))} kg
                      </span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </section>

          <section className="space-y-2.5 rounded-3xl bg-card p-3.5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">Sets by muscle</h2>
              <span className="text-xs text-muted-foreground">{st.sets} sets</span>
            </div>
            {st.parts.length === 0 && <p className="text-sm text-muted-foreground">No sets in the last {period === 'week' ? '7 days' : period === 'month' ? '30 days' : 'year'}.</p>}
            {st.parts.map(([part, n]) => (
              <div key={part} className="grid grid-cols-[86px_minmax(0,1fr)_30px] items-center gap-2">
                <span className="text-[13px] text-foreground/80">{BODY_PART_LABEL[part]}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <span style={{ ...partStyle(part), width: `${(n / maxPart) * 100}%` }} className="block h-2.5 rounded-full bg-[var(--cat)]" />
                </span>
                <span className="text-right text-[13px] font-bold tabular-nums">{n}</span>
              </div>
            ))}
          </section>

          <WorkoutWeeks workouts={workouts} />
        </>
      )}
    </div>
  );
};

// The last five weeks, Monday first: trained days filled, today ringed, days to come dashed.
const WorkoutWeeks = ({ workouts }: { workouts: Workout[] }) => {
  const now = Date.now();
  const weeks = calendarWeeks(workouts, now);
  const streak = weekStreak(workouts, now);
  return (
    <section className="space-y-2.5 rounded-3xl bg-card p-3.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">Workout weeks</h2>
        <span className={cn('text-[13px] font-bold', streak ? 'text-chart-steps' : 'text-muted-foreground')}>
          {streak ? `${streak}-week streak` : 'No streak yet'}
        </span>
      </div>
      <p className="sr-only">
        Trained on {weeks.reduce((n, w) => n + w.days.filter((d) => d.trained).length, 0)} days in the last five weeks.
      </p>
      <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] items-center gap-[5px]" aria-hidden>
        <span />
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-center text-[11px] text-muted-foreground">
            {d}
          </span>
        ))}
        {weeks.map((w) => (
          <div key={w.start} className="contents">
            <span className="text-[11px] tabular-nums text-muted-foreground">{new Date(w.start).getDate()}</span>
            {w.days.map((d) => (
              <span
                key={d.key}
                className={cn(
                  'h-[26px] rounded-[7px]',
                  d.trained ? 'bg-chart-steps' : d.future ? 'border-[1.5px] border-dashed border-border' : 'bg-muted',
                  d.today && 'ring-2 ring-primary ring-offset-1 ring-offset-card'
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">A week counts when you train at least {STREAK_MIN} times.</p>
    </section>
  );
};

export default WorkoutStats;
