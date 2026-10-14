import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { useWeightLogs } from '@/hooks/useWeightLogs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const LB_PER_KG = 2.20462;

// Daily weigh-in: today's reading, the 7-day average and its change from the
// week before (daily weight swings by a kilo or more, so the average is the trend).
const WeightCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const {
    loading,
    saving,
    logWeight,
    todayLog,
    latest,
    weekAvg,
    weekCount,
    prevWeekAvg,
    recent,
  } = useWeightLogs();
  const unit: 'kg' | 'lb' =
    user?.user_metadata?.weight_unit === 'lb' ? 'lb' : 'kg';
  const toDisplay = (kg: number) => (unit === 'lb' ? kg * LB_PER_KG : kg);
  const toKg = (v: number) => (unit === 'lb' ? v / LB_PER_KG : v);
  const round1 = (v: number) => Math.round(v * 10) / 10;

  const baseline = todayLog ?? latest;
  const [draft, setDraft] = useState<number | null>(null);

  // Start the stepper on the last reading once it loads.
  useEffect(() => {
    if (!loading && draft === null)
      setDraft(
        round1(
          baseline ? toDisplay(baseline.weight_kg) : unit === 'lb' ? 154 : 70
        )
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, baseline]);

  if (loading || draft === null) {
    return (
      <div className="elevation-card flex h-[164px] items-center justify-center p-[14px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const step = (dir: 1 | -1) =>
    setDraft((d) =>
      round1(
        Math.min(unit === 'lb' ? 1100 : 499, Math.max(1, (d ?? 0) + dir * 0.1))
      )
    );
  const unchanged =
    todayLog !== null && round1(toDisplay(todayLog.weight_kg)) === draft;

  const save = async () => {
    const ok = await logWeight(toKg(draft));
    if (!ok)
      toast({
        title: 'Error',
        description: 'Failed to save your weight. Please try again.',
        variant: 'destructive',
      });
  };

  const change =
    weekAvg !== null && prevWeekAvg !== null
      ? round1(toDisplay(weekAvg) - toDisplay(prevWeekAvg))
      : null;
  // Green toward the weight goal, amber away from it; no change (or maintaining) stays neutral.
  const goal = user?.user_metadata?.weight_goal;
  const changeTone =
    !change || goal === 'maintain' || !goal
      ? 'text-muted-foreground'
      : (change < 0) === (goal === 'lose')
        ? 'text-chart-fiber'
        : 'text-chart-carbs';

  // No weigh-in this week yet: show the latest reading instead of a blank average.
  const headline = weekAvg ?? latest?.weight_kg ?? null;
  const headlineLabel =
    weekAvg === null && latest
      ? `last weigh-in ${new Date(`${latest.logged_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      : '7-day avg';

  // Sparkline over the last 14 days of weigh-ins.
  const W = 120;
  const H = 32;
  const values = recent.map((l) => l.weight_kg);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const points = recent.map((l, i) => {
    const x = recent.length === 1 ? W / 2 : (i / (recent.length - 1)) * W;
    const y =
      hi === lo ? H / 2 : H - 3 - ((l.weight_kg - lo) / (hi - lo)) * (H - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <div className="elevation-card flex flex-col gap-[10px] p-[14px]">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[12px] font-semibold text-muted-foreground">
          Weight
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {todayLog ? 'Logged today' : 'Not logged today'}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[26px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
            {headline !== null ? toDisplay(headline).toFixed(1) : '—'}
            <span className="font-sans text-xs font-medium text-muted-foreground">
              {' '}
              {unit} · {headlineLabel}
            </span>
          </div>
          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {weekCount} weigh-in{weekCount === 1 ? '' : 's'} this week
            {change !== null && (
              <span className={changeTone}>
                {' · '}
                {change > 0 ? '+' : change < 0 ? '−' : '±'}
                {Math.abs(change).toFixed(1)} vs last week
              </span>
            )}
          </p>
        </div>
        {recent.length > 1 && (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-8 w-[120px] shrink-0 text-primary"
            aria-hidden="true"
          >
            <polyline
              points={points.join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Decrease weight"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center font-mono text-base font-medium tabular-nums text-foreground">
          {draft.toFixed(1)}{' '}
          <span className="text-[11px] text-muted-foreground">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Increase weight"
          className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-muted text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || unchanged}
          className="h-9 rounded-[10px] bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          {todayLog ? 'Update' : 'Log'}
        </button>
      </div>
    </div>
  );
};

export default WeightCard;
