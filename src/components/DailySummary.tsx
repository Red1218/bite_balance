import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface DailySummaryProps {
  calories: number;
  goal: number;
  caloriesBurned?: number;
  weightGoal?: string;
  totals: { protein: number; carbs: number; fat: number; fiber?: number };
}

const R = 96;
const CIRC = 2 * Math.PI * R;
const GAP = 4; // px of track left between macro arcs

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

// The plate draws itself once per app launch; after that it only moves when the numbers do.
let introPlayed = false;

/** Counts from the last shown value to `target` with an ease-out, so totals visibly settle. */
const useCountUp = (target: number, from: number) => {
  const [shown, setShown] = useState(from);
  const shownRef = useRef(from);
  useEffect(() => {
    const start = shownRef.current;
    if (start === target || reducedMotion()) {
      shownRef.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      const v = Math.round(start + (target - start) * (1 - Math.pow(1 - k, 3)));
      shownRef.current = v;
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
};

// Today's plate: the ring fills with protein, carbs and fat in proportion to what was eaten.
const DailySummary = ({ calories, goal, caloriesBurned = 0, weightGoal, totals }: DailySummaryProps) => {
  const { user } = useAuth();
  const [intro] = useState(() => !introPlayed);
  const [drawn, setDrawn] = useState(!intro);

  useEffect(() => {
    introPlayed = true;
    if (drawn) return;
    // Two frames, so the empty ring paints before the arcs transition in.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setDrawn(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const remaining = goal - calories;
  const shownRemaining = useCountUp(drawn ? remaining : goal, intro ? goal : remaining);
  const over = remaining < 0;

  const netCalories = calories - caloriesBurned;
  // Amber when over the target works against a lose goal. The day is still in
  // progress, so being under is never flagged, and gain/maintain stay neutral.
  const awayFromGoal = netCalories > goal && weightGoal === 'lose';

  // Dynamic splits: 30% Protein, 45% Carbs, 25% Fat
  const targets = {
    protein: Math.round(user?.user_metadata?.protein_goal || (goal * 0.3) / 4),
    carbs: Math.round(user?.user_metadata?.carbs_goal || (goal * 0.45) / 4),
    fat: Math.round(user?.user_metadata?.fat_goal || (goal * 0.25) / 9),
    fiber: Math.round(user?.user_metadata?.fiber_goal || 25),
  };

  const fraction = drawn ? Math.min(1, calories / goal) : 0;
  const macroKcal = [
    { kcal: totals.protein * 4, color: 'hsl(var(--chart-protein))' },
    { kcal: totals.carbs * 4, color: 'hsl(var(--chart-carbs))' },
    { kcal: totals.fat * 9, color: 'hsl(var(--chart-fat))' },
  ];
  const macroTotal = macroKcal.reduce((s, m) => s + m.kcal, 0);
  // Meals logged without macros still fill the plate, in a neutral color.
  const slices = macroTotal > 0 ? macroKcal : [{ kcal: 1, color: 'hsl(var(--muted-foreground))' }];
  const sliceTotal = macroTotal > 0 ? macroTotal : 1;
  let offset = 0;
  const arcs = slices.map((m, i) => {
    const full = (CIRC * fraction * m.kcal) / sliceTotal;
    const arc = { color: m.color, len: Math.max(0, full - GAP), offset, delay: i * 140 };
    offset += full;
    return arc;
  });

  const macros = [
    { label: 'Protein', value: totals.protein, target: targets.protein, color: 'bg-chart-protein' },
    { label: 'Carbs', value: totals.carbs, target: targets.carbs, color: 'bg-chart-carbs' },
    { label: 'Fat', value: totals.fat, target: targets.fat, color: 'bg-chart-fat' },
    { label: 'Fiber', value: totals.fiber || 0, target: targets.fiber, color: 'bg-chart-fiber' },
  ];

  return (
    <section aria-label="Today's calories" className="flex flex-col items-center gap-4 rounded-[28px] bg-card p-5">
      <div className="relative h-[220px] w-[220px]">
        <svg width="220" height="220" viewBox="0 0 220 220" aria-hidden className="absolute inset-0">
          <circle cx="110" cy="110" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="18" />
          {calories > 0 &&
            arcs.map((a, i) => (
              <circle
                key={i}
                cx="110"
                cy="110"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="18"
                strokeDasharray={`${a.len} ${CIRC}`}
                strokeDashoffset={-a.offset}
                transform="rotate(-90 110 110)"
                style={{
                  transition: `stroke-dasharray 1000ms var(--ease-settle) ${a.delay}ms, stroke-dashoffset 1000ms var(--ease-settle) ${a.delay}ms`,
                }}
              />
            ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-display text-[52px] font-bold leading-none tracking-[-0.03em] ${over ? 'text-chart-carbs' : 'text-foreground'}`}>
            {Math.abs(shownRemaining).toLocaleString()}
          </span>
          <span className="mt-1 text-sm text-muted-foreground">
            kcal {over ? 'over' : 'left of'} {over ? '' : goal.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="flex w-full justify-between text-sm text-muted-foreground">
        <span>
          Eaten <strong className="font-semibold text-foreground">{calories.toLocaleString()}</strong>
        </span>
        <span>
          Burned <strong className="font-semibold text-foreground">{Math.round(caloriesBurned).toLocaleString()}</strong>
        </span>
        <span>
          Net <strong className={`font-semibold ${awayFromGoal ? 'text-chart-carbs' : 'text-foreground'}`}>{netCalories.toLocaleString()}</strong>
        </span>
      </div>

      <div className="grid w-full grid-cols-4 gap-3">
        {macros.map((m, i) => (
          <div key={m.label} className="flex min-w-0 flex-col gap-1.5">
            <span className="text-[13px] text-muted-foreground">{m.label}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${m.color}`}
                style={{
                  width: `${drawn ? Math.min(100, (m.value / Math.max(1, m.target)) * 100) : 0}%`,
                  transition: `width 800ms var(--ease-settle) ${400 + i * 90}ms`,
                }}
              />
            </div>
            <span className="text-[13px]">
              <strong className="font-semibold text-foreground">{Math.round(m.value)}</strong>
              <span className="text-faint"> / {m.target} g</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};

export default DailySummary;
