import { useRef, useState, type PointerEvent } from 'react';
import { Check, Minus, Pause, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dayState, habitStreaks, logOn, scheduleLabel, weekProgress, type Habit, type LogIndex } from '@/lib/habits';
import type { LogPatch } from '@/hooks/useHabits';
import { HabitTile, Ring, Streak, colorStyle } from './habitUi';

interface HabitRowProps {
  habit: Habit;
  idx: LogIndex;
  date: string; // the day being shown
  today: string;
  onWrite: (next: LogPatch | null) => void;
  onOpen?: () => void; // opens the habit's detail page
}

const SWIPE = 96; // px of drag that commits a swipe
const damp = (x: number) => (x > 140 ? 140 + (x - 140) * 0.25 : x < -140 ? -140 + (x + 140) * 0.25 : x);

// One habit on a day. Rows never reorder when ticked, so the list doesn't jump under a thumb.
// Swipe right to finish it, left to skip it (or un-skip); a tap on the circle still works.
const HabitRow = ({ habit, idx, date, today, onWrite, onOpen }: HabitRowProps) => {
  const log = logOn(idx, habit.id, date);
  const state = dayState(habit, idx, date, today);
  const streaks = habitStreaks(habit, idx, today);
  const note = log?.note ?? null;
  const count = log?.status === 'done' ? (log.count ?? 0) : 0;
  const skipped = state === 'skipped';
  const done = state === 'done';
  // Only a tap animates: rows that load already done stay still.
  const [tapped, setTapped] = useState(false);

  // Horizontal drags only: a mostly vertical move is left to the page scroll.
  const swipeable = habit.kind !== 'avoid';
  const [dx, setDx] = useState(0);
  const dxRef = useRef(0);
  const drag = useRef<{ x0: number; y0: number; active: boolean } | null>(null);
  const justDragged = useRef(false);
  const moveTo = (x: number) => {
    dxRef.current = x;
    setDx(x);
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (swipeable) drag.current = { x0: e.clientX, y0: e.clientY, active: false };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const mx = e.clientX - d.x0;
    const my = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) drag.current = null;
      if (Math.abs(mx) <= 10 || Math.abs(mx) <= Math.abs(my)) return;
      d.active = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    moveTo(damp(mx));
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d?.active) return;
    justDragged.current = true;
    window.setTimeout(() => (justDragged.current = false), 0);
    const x = dxRef.current;
    moveTo(0);
    if (x > SWIPE && !done) {
      setTapped(true);
      if (habit.kind === 'count') setCount(habit.target);
      else onWrite({ status: 'done', count: null, note });
    } else if (x < -SWIPE) {
      onWrite(skipped ? null : { status: 'skipped', count: null, note });
    }
  };
  const pull = Math.min(1, Math.abs(dx) / SWIPE);

  const setCount = (n: number) => onWrite(n > 0 ? { status: 'done', count: n, note } : note ? { status: 'done', count: 0, note } : null);

  const meta = (() => {
    if (skipped) return <span className="font-medium text-chart-water">Skipped{note ? ` · ${note}` : ''}</span>;
    if (habit.kind === 'avoid') {
      if (log?.status === 'slipped') return <span className="font-medium text-primary">Slipped · streak reset</span>;
      return (
        <>
          {log?.status === 'done' ? <span className="font-medium text-chart-fiber">Held</span> : <span>Clean for</span>}
          <Streak value={streaks.current} /> <span>days</span>
        </>
      );
    }
    const parts = [];
    if (habit.kind === 'count') {
      parts.push(
        <span key="c">
          <span className="font-mono text-foreground">{count.toLocaleString()}</span> / {habit.target.toLocaleString()} {habit.unit}
        </span>
      );
    } else if (done) {
      parts.push(<span key="d" className="font-medium text-chart-fiber">Done</span>);
    }
    if (habit.schedule === 'per_week') {
      const week = weekProgress(habit, idx, date, today);
      parts.push(<span key="w"><span className="font-mono text-foreground">{week.done} / {week.target}</span> this week</span>);
    } else if (!done && habit.kind !== 'count') {
      parts.push(<span key="s">{scheduleLabel(habit)}</span>);
    }
    if (streaks.current > 0)
      parts.push(
        <span key={`k${done && tapped ? 'bump' : ''}`} className={done && tapped ? 'motion-bump' : 'inline-flex'}>
          <Streak value={streaks.current} unit={streaks.unit} />
        </span>
      );
    return parts.flatMap((p, i) => (i ? [<span key={`dot${i}`} aria-hidden className="h-[3px] w-[3px] rounded-full bg-current opacity-60" />, p] : [p]));
  })();

  const control = (() => {
    if (skipped) {
      return (
        <button
          type="button"
          onClick={() => onWrite(null)}
          aria-label={`${habit.name} skipped. Tap to undo`}
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 border-dashed border-chart-water text-chart-water"
        >
          <Pause className="h-4 w-4" strokeWidth={3} />
        </button>
      );
    }
    if (habit.kind === 'count') {
      return (
        <div className="flex flex-none items-center gap-0.5">
          <button
            type="button"
            onClick={() => setCount(count - 1)}
            disabled={count === 0}
            aria-label={`Remove one from ${habit.name}`}
            className="flex h-11 w-10 items-center justify-center rounded-full bg-muted text-foreground disabled:opacity-40"
          >
            <Minus className="h-4 w-4" strokeWidth={2.6} />
          </button>
          <Ring
            value={count / habit.target}
            size={44}
            stroke={4}
            color={done ? 'hsl(var(--chart-fiber))' : 'color-mix(in srgb, var(--c) 78%, hsl(var(--foreground)))'}
            label={`${count} of ${habit.target}`}
          >
            {done ? <Check className="h-4 w-4 text-chart-fiber" strokeWidth={3} /> : <span className="font-mono text-[13px] font-semibold">{count > 999 ? `${Math.round(count / 100) / 10}k` : count}</span>}
          </Ring>
          <button
            type="button"
            onClick={() => setCount(count + 1)}
            aria-label={`Add one to ${habit.name}`}
            className="flex h-11 w-10 items-center justify-center rounded-full bg-muted text-foreground"
          >
            <Plus className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      );
    }
    if (habit.kind === 'avoid') return null; // shown as a Held / Slipped pair below
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={habit.name}
        onClick={() => {
          setTapped(true);
          onWrite(done ? null : { status: 'done', count: null, note });
        }}
        className={cn(
          'flex h-11 w-11 flex-none items-center justify-center rounded-full border-2 transition-colors duration-200 active:scale-90',
          done ? 'border-chart-fiber bg-chart-fiber text-background' : 'border-muted-foreground/45',
          done && tapped && 'motion-pop'
        )}
      >
        {done && <Check className={cn('h-5 w-5', tapped && 'motion-draw')} strokeWidth={3} />}
      </button>
    );
  })();

  const avoidPick = (status: 'done' | 'slipped') => onWrite(log?.status === status ? null : { status, count: null, note });

  return (
    <div className="relative overflow-hidden" style={colorStyle(habit.color)}>
      {swipeable && dx !== 0 && (
        <div
          aria-hidden
          className={cn('absolute inset-0 flex items-center px-6 text-background', dx > 0 ? 'justify-start bg-chart-fiber' : 'justify-end bg-chart-water')}
        >
          {dx > 0 ? (
            <Check className="h-6 w-6" strokeWidth={3} style={{ opacity: pull, transform: `scale(${0.5 + pull * 0.7}) rotate(${(pull - 1) * 30}deg)` }} />
          ) : (
            <span className="text-sm font-bold" style={{ opacity: pull, transform: `scale(${0.7 + pull * 0.3})` }}>
              {skipped ? 'Undo skip' : 'Skip'}
            </span>
          )}
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (justDragged.current) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="relative flex touch-pan-y flex-col gap-2.5 bg-card py-2.5 pl-3 pr-2.5"
        style={{
          transform: dx ? `translateX(${dx}px) rotate(${dx / 80}deg)` : undefined,
          transition: drag.current?.active ? 'none' : 'transform 480ms cubic-bezier(.34,1.45,.64,1)',
        }}
      >
      {done && tapped && <span aria-hidden className="motion-grow pointer-events-none absolute inset-0 origin-left bg-chart-fiber/10" />}
      <div className="relative flex min-h-11 items-center gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Open ${habit.name}`}>
          <HabitTile habit={habit} />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-[15px] font-medium text-foreground">{habit.name}</span>
              {habit.kind === 'avoid' && (
                <span className="flex-none rounded-md border border-border px-1.5 text-[12px] font-semibold text-muted-foreground">
                  Avoid
                </span>
              )}
            </span>
            <span className="mt-px flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">{meta}</span>
          </span>
        </button>
        {control}
      </div>
      {habit.kind === 'avoid' && !skipped && (
        <div className="grid grid-cols-2 gap-1.5 pl-12" role="radiogroup" aria-label={`${habit.name} today`}>
          <button
            type="button"
            role="radio"
            aria-checked={log?.status === 'done'}
            onClick={() => avoidPick('done')}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] text-[13px] font-semibold',
              log?.status === 'done' ? 'border-chart-fiber bg-chart-fiber text-white' : 'border-border text-foreground',
              log?.status === 'slipped' && 'opacity-60'
            )}
          >
            <Check className="h-4 w-4" strokeWidth={3} /> Held
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={log?.status === 'slipped'}
            onClick={() => avoidPick('slipped')}
            className={cn(
              'flex h-11 items-center justify-center gap-1.5 rounded-full border-[1.5px] text-[13px] font-semibold',
              log?.status === 'slipped' ? 'border-2 border-primary bg-primary/10 text-primary' : 'border-border text-foreground',
              log?.status === 'done' && 'opacity-60'
            )}
          >
            <X className="h-4 w-4" strokeWidth={3} /> Slipped
          </button>
        </div>
      )}
      </div>
    </div>
  );
};

export default HabitRow;
