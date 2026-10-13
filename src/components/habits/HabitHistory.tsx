import { Fragment, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, fmtLocalDate } from '@/lib/utils';
import { dayProgress, dayState, isActiveOn, type Habit, type LogIndex } from '@/lib/habits';
import { STATE_WORD, SectionLabel, StateMark, colorStyle } from './habitUi';

export const shortDate = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', opts);

export const NavButton = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="flex h-11 w-10 items-center justify-center rounded-full text-foreground disabled:opacity-30"
  >
    {children}
  </button>
);

export const StateLegend = () => (
  <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
    {(['done', 'partial', 'missed', 'skipped', 'off'] as const).map((s) => (
      <span key={s} className="flex items-center gap-1.5">
        <StateMark state={s} size={14} />
        {s === 'off' ? 'Off' : s[0].toUpperCase() + s.slice(1)}
      </span>
    ))}
  </div>
);

interface WeekGridProps {
  habits: Habit[];
  idx: LogIndex;
  days: string[]; // 7 days, oldest first
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onShift: (weeks: number) => void;
}

export const WeekGrid = ({ habits, idx, days, today, selected, onSelect, onShift }: WeekGridProps) => {
  const shown = habits.filter((h) => days.some((d) => isActiveOn(h, d)));
  return (
    <section className="elevation-card rounded-2xl px-3 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between pl-1">
        <SectionLabel>This week</SectionLabel>
        <div className="flex items-center">
          <NavButton label="Previous week" onClick={() => onShift(-1)}><ChevronLeft className="h-[18px] w-[18px]" /></NavButton>
          <span className="font-mono text-xs">
            {shortDate(days[0], { day: 'numeric', month: 'short' })} – {shortDate(days[6], { day: 'numeric', month: 'short' })}
          </span>
          <NavButton label="Next week" disabled={days[6] >= today} onClick={() => onShift(1)}><ChevronRight className="h-[18px] w-[18px]" /></NavButton>
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No habits this week</p>
      ) : (
        <div className="grid items-center gap-x-0.5" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(7, 32px)' }}>
          <span />
          {days.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-label={shortDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
              aria-pressed={d === selected}
              className={cn('flex h-11 flex-col items-center justify-center rounded-t-lg', d === selected && 'bg-primary/10')}
            >
              <span className="text-[9px] font-semibold uppercase leading-none text-muted-foreground">{shortDate(d, { weekday: 'narrow' })}</span>
              <span className={cn('font-mono text-[11px] leading-tight', d === today && 'font-semibold text-primary')}>{Number(d.slice(8))}</span>
            </button>
          ))}
          {shown.map((h) => (
            <Fragment key={h.id}>
              <span className="flex h-8 min-w-0 items-center gap-2 text-[13px] font-medium">
                <span className="h-4 w-1 flex-none rounded-sm bg-[var(--c)]" style={colorStyle(h.color)} />
                <span className="truncate">{h.name}</span>
              </span>
              {days.map((d) => {
                const state = dayState(h, idx, d, today);
                return (
                  <span key={d} className={cn('flex h-8 items-center justify-center', d === selected && 'bg-primary/10')} role="img" aria-label={`${h.name}, ${shortDate(d, { month: 'short', day: 'numeric' })}: ${STATE_WORD[state]}`}>
                    <StateMark state={state} />
                  </span>
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
      <div className="mt-3 border-t border-border pt-2.5">
        <StateLegend />
      </div>
    </section>
  );
};

interface MonthHeatmapProps {
  habits: Habit[];
  idx: LogIndex;
  month: string; // 'YYYY-MM-01'
  today: string;
  selected: string;
  onSelect: (date: string) => void;
  onShift: (months: number) => void;
}

export const monthStartOf = (date: string) => `${date.slice(0, 7)}-01`;

export const MonthHeatmap = ({ habits, idx, month, today, selected, onSelect, onShift }: MonthHeatmapProps) => {
  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const firstWeekday = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7; // Mon = 0
  const cells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month.slice(0, 8)}${String(i + 1).padStart(2, '0')}`),
  ];
  let perfect = 0;

  return (
    <section className="elevation-card rounded-2xl px-3.5 pb-3.5 pt-1.5">
      <div className="flex items-center justify-between pl-0.5">
        <SectionLabel>{shortDate(month, { month: 'long', year: 'numeric' })}</SectionLabel>
        <div className="flex">
          <NavButton label="Previous month" onClick={() => onShift(-1)}><ChevronLeft className="h-[18px] w-[18px]" /></NavButton>
          <NavButton label="Next month" disabled={month >= monthStartOf(today)} onClick={() => onShift(1)}><ChevronRight className="h-[18px] w-[18px]" /></NavButton>
        </div>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center text-[9px] font-semibold uppercase text-muted-foreground">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((date, i) => {
          if (!date) return <span key={`b${i}`} />;
          const future = date > today;
          const p = future ? null : dayProgress(habits, idx, date, today);
          const tone = !p || (p.due === 0 && p.skipped === 0) ? 'none-due' : p.due === 0 ? 'skip' : p.done === p.due ? 'all' : p.pct > 0 ? 'some' : 'none';
          if (tone === 'all' && date !== today) perfect++;
          const word = { 'none-due': future ? 'upcoming' : 'nothing due', skip: 'skipped day', all: 'all done', some: `${p?.pct}% done`, none: 'none done' }[tone];
          return (
            <button
              key={date}
              type="button"
              disabled={future}
              onClick={() => onSelect(date)}
              aria-label={`${shortDate(date, { month: 'long', day: 'numeric' })}: ${word}`}
              className={cn(
                'relative flex h-10 items-center justify-center rounded-[10px] font-mono text-xs font-medium',
                tone === 'all' && 'bg-chart-fiber text-white',
                tone === 'some' && 'bg-chart-fiber/20 text-foreground',
                tone === 'none' && 'border-[1.5px] border-border text-muted-foreground',
                tone === 'skip' && 'border-[1.5px] border-dashed border-chart-water text-foreground',
                tone === 'none-due' && 'text-muted-foreground/60',
                date === today && 'ring-2 ring-primary',
                date === selected && date !== today && 'ring-2 ring-foreground/60'
              )}
            >
              {Number(date.slice(8))}
              {tone === 'all' && <Check className="absolute right-1 top-1 h-2.5 w-2.5" strokeWidth={4} />}
              {tone === 'some' && (
                <span className="absolute inset-x-[7px] bottom-[5px] h-[3px] rounded-sm bg-chart-fiber/25">
                  <span className="block h-full rounded-sm bg-chart-fiber" style={{ width: `${p?.pct}%` }} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-chart-fiber" />All done</span>
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded bg-chart-fiber/20" />Some</span>
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded border-[1.5px] border-border" />None</span>
        <span className="flex items-center gap-1.5"><span className="h-4 w-4 rounded border-[1.5px] border-dashed border-chart-water" />Skipped</span>
        <span className="ml-auto font-mono text-foreground">{perfect} perfect {perfect === 1 ? 'day' : 'days'}</span>
      </div>
    </section>
  );
};

export const fmtMonthShift = (month: string, n: number) => {
  const [year, monthNum] = month.split('-').map(Number);
  return fmtLocalDate(new Date(year, monthNum - 1 + n, 1));
};
