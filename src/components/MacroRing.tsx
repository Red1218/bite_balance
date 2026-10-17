import type { ReactNode } from 'react';

interface MacroRingProps {
  protein: number;
  carbs: number;
  fat: number;
  size: number;
  stroke: number;
  /** How much of the ring the macros fill, 0..1; the whole ring by default. */
  fill?: number;
  /** Animate arc changes (the detail screen does, list rows don't). */
  animate?: boolean;
  children?: ReactNode;
}

const GAP = 3; // px of track between arcs

/** A ring split into protein, carbs and fat by their share of the calories. */
const MacroRing = ({ protein, carbs, fat, size, stroke, fill = 1, animate = false, children }: MacroRingProps) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const parts = [
    { kcal: protein * 4, color: 'hsl(var(--chart-protein))' },
    { kcal: carbs * 4, color: 'hsl(var(--chart-carbs))' },
    { kcal: fat * 9, color: 'hsl(var(--chart-fat))' },
  ];
  const total = parts.reduce((s, p) => s + p.kcal, 0);
  let offset = 0;
  return (
    <span className="relative inline-flex flex-none" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="absolute inset-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        {total > 0 &&
          parts.map((p, i) => {
            const full = (c * Math.max(0, Math.min(1, fill)) * p.kcal) / total;
            const arc = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, full - GAP)} ${c}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                style={
                  animate
                    ? { transition: `stroke-dasharray 800ms var(--ease-settle) ${i * 90}ms, stroke-dashoffset 800ms var(--ease-settle) ${i * 90}ms` }
                    : undefined
                }
              />
            );
            offset += full;
            return arc;
          })}
      </svg>
      {children && <span className="absolute inset-0 flex flex-col items-center justify-center">{children}</span>}
    </span>
  );
};

export default MacroRing;
