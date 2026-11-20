// Small shared pieces of the workout screens.
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { BODY_PARTS, BODY_PART_LABEL, type BodyPart } from '@/lib/workouts';

// Each body part keeps one colour everywhere (tags, chips), cycling through the chart colours.
const PART_COLORS = ['--chart-steps', '--chart-fat', '--chart-water', '--chart-fiber', '--chart-carbs', '--chart-protein'];
export const partStyle = (part: BodyPart) =>
  ({ '--cat': `hsl(var(${PART_COLORS[BODY_PARTS.findIndex(([p]) => p === part) % PART_COLORS.length]}))` }) as CSSProperties;

export const tintBg = 'bg-[color-mix(in_srgb,var(--cat)_18%,transparent)]';
export const tintInk = 'text-[color:color-mix(in_srgb,var(--cat)_70%,hsl(var(--foreground)))]';

export const PartTag = ({ part }: { part: BodyPart }) => (
  <span style={partStyle(part)} className={cn('rounded-full px-2 py-[3px] text-[11px] font-bold', tintBg, tintInk)}>
    {BODY_PART_LABEL[part]}
  </span>
);

export const Tag = ({ children }: { children: ReactNode }) => (
  <span className="rounded-full bg-muted px-2 py-[3px] text-[11px] font-semibold text-muted-foreground">{children}</span>
);

interface ChipProps {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}

export const Chip = ({ on, onClick, children, className }: ChipProps) => (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    className={cn(
      'h-9 flex-none rounded-full px-3 text-[13px] font-semibold transition-colors',
      on ? 'bg-foreground text-background' : 'bg-muted text-foreground/80',
      className
    )}
  >
    {children}
  </button>
);
