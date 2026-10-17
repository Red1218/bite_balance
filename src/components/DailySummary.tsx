import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FLIGHT_MS } from '@/lib/flyToPlate';
import Odometer from './Odometer';

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

// Eight sparks spread evenly around the ring, 130px out from the centre.
const SPARKS = Array.from({ length: 8 }, (_, i) => ({
  x: `${Math.round(Math.cos((i / 8) * 2 * Math.PI) * 130)}px`,
  y: `${Math.round(Math.sin((i / 8) * 2 * Math.PI) * 130)}px`,
}));

// The plate draws itself once per app launch; after that it only moves when the numbers do.
let introPlayed = false;

// Today's plate: the ring fills with protein, carbs and fat in proportion to what was eaten.
const DailySummary = ({ calories: liveCalories, goal, caloriesBurned = 0, weightGoal, totals: liveTotals }: DailySummaryProps) => {
  const { user } = useAuth();
  const [intro] = useState(() => !introPlayed);
  const [drawn, setDrawn] = useState(!intro);

  useEffect(() => {
    introPlayed = true;
    if (!intro) return;
    // Two frames, so the empty ring paints before the arcs transition in.
    let id = requestAnimationFrame(() => {
      id = requestAnimationFrame(() => setDrawn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [intro]);

  // A newly logged meal flies up from the list first; the plate takes the new totals as it lands,
  // dips, and sends out a ring of sparks. Removals and edits apply at once.
  const [landed, setLanded] = useState({ calories: liveCalories, totals: liveTotals });
  const [burst, setBurst] = useState(0);
  const ringRef = useRef<HTMLDivElement>(null);
  const liveKey = `${liveCalories}|${liveTotals.protein}|${liveTotals.carbs}|${liveTotals.fat}|${liveTotals.fiber ?? 0}`;
  useEffect(() => {
    const next = { calories: liveCalories, totals: liveTotals };
    if (liveCalories <= landed.calories || reducedMotion()) {
      setLanded(next);
      return;
    }
    const t = window.setTimeout(() => {
      setLanded(next);
      setBurst((b) => b + 1);
      ringRef.current?.animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(.93)', offset: 0.35 }, { transform: 'scale(1)' }],
        { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' }
      );
    }, FLIGHT_MS);
    return () => window.clearTimeout(t);
    // liveKey stands for the live totals; landed is what the plate shows, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  const { calories, totals } = landed;

  const remaining = goal - calories;
  const over = remaining < 0;

  const netCalories = Math.round(calories - caloriesBurned);
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
      <div ref={ringRef} id="plate-ring" className="relative h-[220px] w-[220px]">
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
        {burst > 0 && (
          <span key={burst} aria-hidden className="pointer-events-none absolute inset-0">
            <span className="motion-burst absolute inset-0 rounded-full shadow-[0_0_0_3px_hsl(var(--chart-carbs))]" />
            {SPARKS.map((sp, i) => (
              <span
                key={i}
                className="motion-spark absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full"
                style={{ '--sx': sp.x, '--sy': sp.y, background: i % 2 ? 'hsl(var(--chart-carbs))' : 'hsl(var(--foreground))' } as CSSProperties}
              />
            ))}
          </span>
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Odometer
            value={drawn ? remaining : goal}
            className={`font-display text-[52px] font-bold tracking-[-0.03em] ${over ? 'text-chart-carbs' : 'text-foreground'}`}
          />
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
