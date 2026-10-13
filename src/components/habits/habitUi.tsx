// Small shared pieces of the habit screens: icons, colors, state marks, progress rings.
import type { CSSProperties, ReactNode } from 'react';
import {
  Apple, Ban, BookOpen, Brain, Check, Coffee, Droplet, Dumbbell, Flame, Footprints, Heart, Leaf, Moon, Pause, Pill, Sun, Target, X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DayState, Habit, HabitCategory, HabitColor, TimeOfDay } from '@/lib/habits';

export const ICONS: Record<string, LucideIcon> = {
  check: Check, pill: Pill, sun: Sun, droplet: Droplet, target: Target, footprints: Footprints, moon: Moon,
  dumbbell: Dumbbell, ban: Ban, book: BookOpen, leaf: Leaf, heart: Heart, coffee: Coffee, apple: Apple, brain: Brain,
};
export const ICON_KEYS = Object.keys(ICONS);

const COLOR_VAR: Record<HabitColor, string> = {
  red: 'hsl(var(--primary))',
  orange: 'hsl(var(--chart-steps))',
  amber: 'hsl(var(--chart-carbs))',
  sky: 'hsl(var(--chart-water))',
  violet: 'hsl(var(--chart-fat))',
};
// Sets --c for the .habit-tint / .habit-ink utilities.
export const colorStyle = (color: HabitColor) => ({ '--c': COLOR_VAR[color] }) as CSSProperties;

export const TIME_LABEL: Record<TimeOfDay, string> = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', anytime: 'Anytime' };
export const CATEGORY_LABEL: Record<HabitCategory, string> = {
  supplements: 'Supplements', fitness: 'Fitness', nutrition: 'Nutrition', mind: 'Mind', sleep: 'Sleep',
};

export const HabitTile = ({ habit, size = 36 }: { habit: Pick<Habit, 'icon' | 'color'>; size?: number }) => {
  const Icon = ICONS[habit.icon] ?? Check;
  return (
    <span
      className="habit-tint flex flex-none items-center justify-center rounded-[10px]"
      style={{ ...colorStyle(habit.color), width: size, height: size }}
    >
      <Icon style={{ width: size / 2, height: size / 2 }} />
    </span>
  );
};

export const SectionLabel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn('font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground', className)}>{children}</h2>
);

export const Streak = ({ value, unit = 'd', className }: { value: number; unit?: 'd' | 'wk'; className?: string }) => (
  <span className={cn('inline-flex items-center gap-0.5 font-mono tabular-nums text-foreground', className)}>
    <Flame className="h-3 w-3 text-chart-carbs" aria-hidden />
    {value}
    {unit === 'wk' && <span className="text-muted-foreground">wk</span>}
    <span className="sr-only"> {unit === 'wk' ? 'week' : 'day'} streak</span>
  </span>
);

// A state told apart by shape, not only color: filled + check, half-filled, ring + ×, dashed ring + pause, dot.
export const StateMark = ({ state, size = 20 }: { state: DayState; size?: number }) => {
  const icon = Math.round(size * 0.55);
  const box = { width: size, height: size };
  switch (state) {
    case 'done':
      return (
        <span className="flex flex-none items-center justify-center rounded-full bg-chart-fiber text-white" style={box}>
          <Check strokeWidth={3.5} style={{ width: icon, height: icon }} />
        </span>
      );
    case 'partial':
      return <span className="flex-none rounded-full border-[1.5px] border-chart-fiber bg-[linear-gradient(90deg,hsl(var(--chart-fiber))_50%,transparent_50%)]" style={box} />;
    case 'missed':
      return (
        <span className="flex flex-none items-center justify-center rounded-full border-[1.5px] border-muted-foreground text-muted-foreground" style={box}>
          <X strokeWidth={3.5} style={{ width: icon * 0.8, height: icon * 0.8 }} />
        </span>
      );
    case 'skipped':
      return (
        <span className="flex flex-none items-center justify-center rounded-full border-[1.5px] border-dashed border-chart-water text-chart-water" style={box}>
          <Pause strokeWidth={3.5} style={{ width: icon * 0.8, height: icon * 0.8 }} />
        </span>
      );
    case 'pending':
      return <span className="flex-none rounded-full border-[1.5px] border-muted-foreground/45" style={box} />;
    default:
      return <span className="h-[5px] w-[5px] flex-none rounded-full bg-muted-foreground/40" />;
  }
};

export const STATE_WORD: Record<DayState, string> = {
  done: 'done', partial: 'partly done', missed: 'missed', skipped: 'skipped', off: 'not scheduled', pending: 'not done yet',
};

// Circular progress. `value` 0..1.
export const Ring = ({
  value, size, stroke, color = 'hsl(var(--chart-fiber))', children, label,
}: { value: number; size: number; stroke: number; color?: string; children?: ReactNode; label?: string }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative flex-none" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        {value > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.min(1, value) * c} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-[stroke-dasharray] duration-300"
          />
        )}
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
};
