import { useState } from 'react';
import { Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, dayProgress, habitStreaks, logOn, weekdayOf, type Habit, type LogIndex } from '@/lib/habits';
import { HabitTile, SectionLabel, Streak } from './habitUi';
import { shortDate } from './HabitHistory';

const RANGES = [[7, '7 days'], [30, '30 days'], [84, '12 weeks']] as const;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

// Average completion over `days` days ending at `end`; days with nothing due, and today
// while it's still open, are left out.
const average = (habits: Habit[], idx: LogIndex, end: string, days: number, today: string) => {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(end, -i);
    const p = dayProgress(habits, idx, date, today);
    if (!p.due || (date === today && p.done < p.due)) continue;
    sum += p.pct;
    n++;
  }
  return n ? Math.round(sum / n) : null;
};

const HabitStats = ({ habits, idx, today }: { habits: Habit[]; idx: LogIndex; today: string }) => {
  const [range, setRange] = useState<number>(7);
  const overall = average(habits, idx, today, range, today);
  const previous = average(habits, idx, addDays(today, -range), range, today);
  const delta = overall !== null && previous !== null ? overall - previous : null;

  // Daily bars: the last 7 days for the 7-day range, weekly averages otherwise.
  const bars =
    range === 7
      ? Array.from({ length: 7 }, (_, i) => {
          const date = addDays(today, i - 6);
          const p = dayProgress(habits, idx, date, today);
          return { key: date, label: date === today ? 'Now' : shortDate(date, { weekday: 'narrow' }), value: p.due ? p.pct : null, open: date === today };
        })
      : Array.from({ length: Math.round(range / 7) }, (_, i) => {
          const end = addDays(today, -7 * (Math.round(range / 7) - 1 - i));
          return { key: end, label: shortDate(addDays(end, -6), { day: 'numeric', month: 'numeric' }), value: average(habits, idx, end, 7, today), open: i === Math.round(range / 7) - 1 };
        });

  // Best weekday over the last 12 weeks (yesterday back, so an open today doesn't drag it down).
  const byDay = new Map<number, { sum: number; n: number }>();
  for (let i = 1; i <= 84; i++) {
    const date = addDays(today, -i);
    const p = dayProgress(habits, idx, date, today);
    if (!p.due) continue;
    const w = weekdayOf(date);
    const cur = byDay.get(w) ?? { sum: 0, n: 0 };
    byDay.set(w, { sum: cur.sum + p.pct, n: cur.n + 1 });
  }
  const dow = MONDAY_FIRST.map((w) => ({ w, value: byDay.has(w) ? Math.round(byDay.get(w)!.sum / byDay.get(w)!.n) : null }));
  const ranked = dow.filter((d) => d.value !== null).sort((a, b) => b.value! - a.value!);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  // Ties are common (two 100% days), so name every day that shares the top or bottom score.
  const tops = best ? ranked.filter((d) => d.value === best.value).map((d) => d.w) : [];
  const bottoms = worst && worst.value !== best?.value ? ranked.filter((d) => d.value === worst.value).map((d) => d.w) : [];
  const dayList = (ws: number[]) => {
    const names = ws.map((w) => `${DAY_NAMES[w]}s`);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  };

  const leaders = habits
    .filter((h) => !h.archived_at)
    .map((h) => ({ h, s: habitStreaks(h, idx, today) }))
    .filter(({ s }) => s.current > 0 || s.best > 0)
    .sort((a, b) => b.s.current - a.s.current || b.s.best - a.s.best)
    .slice(0, 5);
  const maxStreak = Math.max(1, ...leaders.map(({ s }) => Math.max(s.current, s.best)));

  // Skipped days this calendar month.
  const monthStart = `${today.slice(0, 8)}01`;
  const skips: { date: string; note: string | null }[] = [];
  for (let d = monthStart; d <= today; d = addDays(d, 1)) {
    const skipped = habits.map((h) => logOn(idx, h.id, d)).filter((l) => l?.status === 'skipped');
    if (skipped.length) skips.push({ date: d, note: skipped.find((l) => l?.note)?.note ?? null });
  }

  return (
    <div className="space-y-3.5">
      <div className="flex gap-1.5">
        {RANGES.map(([days, label]) => (
          <button
            key={days}
            type="button"
            aria-pressed={range === days}
            onClick={() => setRange(days)}
            className={cn('h-11 rounded-full px-4 text-[13px] font-semibold', range === days ? 'bg-foreground text-background' : 'border border-border text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      <section className="elevation-card rounded-2xl p-3.5">
        <div className="flex items-start justify-between">
          <div>
            <SectionLabel>Overall completion</SectionLabel>
            <div className="font-mono text-[44px] font-semibold leading-tight tracking-tight">
              {overall ?? '–'}
              {overall !== null && <span className="text-[22px] text-muted-foreground">%</span>}
            </div>
          </div>
          {delta !== null && (
            <div className="mt-[18px] text-right">
              <div className={cn('font-mono text-[13px] font-semibold', delta >= 0 ? 'text-chart-fiber' : 'text-primary')}>
                {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)} pts
              </div>
              <div className="text-xs text-muted-foreground">vs previous {RANGES.find(([d]) => d === range)![1]}</div>
            </div>
          )}
        </div>
        <div className="mt-3 flex h-[120px] items-end gap-2" role="img" aria-label={`Completion: ${bars.map((b) => `${b.label} ${b.value ?? 'none'}`).join(', ')}`}>
          {bars.map((b) => (
            <div key={b.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] text-muted-foreground">{b.value ?? ''}</span>
              <span
                className={cn('w-full rounded-md', b.open ? 'bg-chart-fiber/35 ring-[1.5px] ring-inset ring-chart-fiber' : b.value === 100 ? 'bg-chart-fiber' : 'bg-chart-fiber/65')}
                style={{ height: `${Math.max(2, (b.value ?? 0) * 0.92)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {bars.map((b) => (
            <span key={b.key} className={cn('flex-1 text-center text-[12px] font-semibold', b.open ? 'text-primary' : 'text-muted-foreground')}>{b.label}</span>
          ))}
        </div>
      </section>

      {best && (
        <section className="elevation-card rounded-2xl p-3.5">
          <SectionLabel>Best day of the week</SectionLabel>
          <div className="mt-1 font-display text-lg font-semibold">{dayList(tops)} are your strongest</div>
          <div className="mb-2.5 text-[13px] text-muted-foreground">
            {bottoms.length > 0 ? `${dayList(bottoms)} slip most, over the last 12 weeks.` : 'Over the last 12 weeks.'}
          </div>
          {dow.map((d) => (
            <div key={d.w} className="grid h-[26px] grid-cols-[34px_minmax(0,1fr)_40px] items-center gap-2.5 text-xs">
              <span className="text-[12px] font-semibold">{DAY_NAMES[d.w].slice(0, 3)}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-muted">
                <span className={cn('block h-full origin-left rounded-full motion-grow', tops.includes(d.w) ? 'bg-chart-fiber' : 'bg-muted-foreground/45')} style={{ width: `${d.value ?? 0}%` }} />
              </span>
              <span className={cn('text-right font-mono', tops.includes(d.w) && 'font-semibold')}>{d.value === null ? '–' : `${d.value}%`}</span>
            </div>
          ))}
        </section>
      )}

      {leaders.length > 0 && (
        <section className="elevation-card rounded-2xl px-3.5 py-2">
          <div className="flex items-baseline justify-between pb-1 pt-1.5">
            <SectionLabel>Longest active streaks</SectionLabel>
            <span className="text-[11px] text-muted-foreground">current · best</span>
          </div>
          {leaders.map(({ h, s }, i) => (
            <div key={h.id} className="flex min-h-[54px] items-center gap-2.5 border-t border-border first-of-type:border-0">
              <span className="w-3.5 text-right font-mono text-xs text-muted-foreground">{i + 1}</span>
              <HabitTile habit={h} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{h.name}</span>
                  <span className="flex flex-none items-center gap-1 text-[13px]">
                    <Streak value={s.current} unit={s.unit} className="font-semibold" />
                    <span className="font-mono text-[11px] text-muted-foreground">· {s.best}</span>
                  </span>
                </div>
                <div className="relative mt-1.5 h-1.5 rounded-full bg-muted">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-chart-carbs" style={{ width: `${(s.current / maxStreak) * 100}%` }} />
                  <span className="absolute -inset-y-[3px] w-0.5 rounded-sm bg-foreground" style={{ left: `calc(${(s.best / maxStreak) * 100}% - 1px)` }} aria-hidden />
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-1.5 pb-2 pt-1.5 text-[11px] text-muted-foreground">
            <span className="h-2.5 w-0.5 rounded-sm bg-foreground" />
            tick marks each habit's best streak
          </div>
        </section>
      )}

      <section className="elevation-card flex items-center gap-3 rounded-2xl p-3.5">
        <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border-2 border-dashed border-chart-water text-chart-water">
          <Pause className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
        <div className="flex-1">
          <div className="font-medium">
            <span className="font-mono">{skips.length}</span> skipped {skips.length === 1 ? 'day' : 'days'} this month
          </div>
          <div className="text-xs text-muted-foreground">
            {skips.length
              ? `${skips.map((s) => `${s.note ?? 'skipped'} on ${shortDate(s.date, { day: 'numeric', month: 'short' })}`).join(', ')}. No streaks were broken.`
              : 'Skip a day from a habit’s page when you’re sick or travelling.'}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HabitStats;
