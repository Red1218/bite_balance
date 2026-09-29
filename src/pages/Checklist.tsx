import { Fragment, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { cn, fmtLocalDate } from '@/lib/utils';
import {
  addDays, dayProgress, isActiveOn, isChecked, isDue, scheduleLabel,
  type ChecklistCheck, type ChecklistItem,
} from '@/lib/checklist';
import { useChecklist, useLocalToday } from '@/hooks/useChecklist';
import ChecklistRow from '@/components/ChecklistRow';
import ChecklistItemSheet from '@/components/ChecklistItemSheet';

type CellState = 'done' | 'missed' | 'off';
const CELL_CLASS: Record<CellState, string> = {
  done: 'h-3 w-3 rounded-full bg-chart-fiber',
  missed: 'h-3 w-3 rounded-full border-2 border-muted-foreground/50',
  off: 'h-0.5 w-2 rounded-full bg-muted-foreground/25',
};

type MonthTone = 'plain' | 'zero' | 'some' | 'all';
const MONTH_CLASS: Record<MonthTone, string> = {
  plain: 'bg-muted/40 text-muted-foreground',
  zero: 'bg-muted-foreground/20 text-foreground',
  some: 'bg-chart-fiber/40 text-foreground',
  all: 'bg-chart-fiber text-background',
};

const cellState = (item: ChecklistItem, checks: ChecklistCheck[], date: string): CellState =>
  !isDue(item, date) ? 'off' : isChecked(checks, item.id, date) ? 'done' : 'missed';

const monthStartOf = (date: string) => `${date.slice(0, 7)}-01`;
const shortDate = (date: string, opts: Intl.DateTimeFormatOptions) => new Date(`${date}T00:00:00`).toLocaleDateString('en-US', opts);

const NavButton = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) => (
  <button
    type="button"
    aria-label={label}
    onClick={onClick}
    disabled={disabled}
    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground disabled:opacity-30"
  >
    {children}
  </button>
);

const Checklist = () => {
  const today = useLocalToday();
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [weekEnd, setWeekEnd] = useState(today);
  const [month, setMonth] = useState(() => monthStartOf(today)); // 'YYYY-MM-01'
  const [selectedDate, setSelectedDate] = useState(today);
  const [sheetItem, setSheetItem] = useState<ChecklistItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekEnd, i - 6));
  // One range covers the week grid, the month calendar and the selected day.
  const from = [weekDays[0], month, selectedDate].sort()[0];
  const { items, checks, loading, error, toggle, saveItem, archiveItem } = useChecklist(from, today);

  const openSheet = (item: ChecklistItem | null) => {
    setSheetItem(item);
    setSheetOpen(true);
  };

  const weekItems = items.filter((i) => weekDays.some((d) => isActiveOn(i, d)));
  const activeItems = items.filter((i) => !i.archived_at);
  const selectedDue = items.filter((i) => isDue(i, selectedDate));
  const selectedProgress = dayProgress(items, checks, selectedDate);

  const [year, monthNum] = month.split('-').map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const firstWeekday = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7; // Mon = 0
  const monthCells: (string | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${month.slice(0, 8)}${String(i + 1).padStart(2, '0')}`),
  ];
  const shiftMonth = (n: number) => setMonth(fmtLocalDate(new Date(year, monthNum - 1 + n, 1)));
  const monthTone = (date: string): MonthTone => {
    if (date > today) return 'plain';
    const p = dayProgress(items, checks, date);
    if (!p.due) return 'plain';
    return p.done === 0 ? 'zero' : p.done < p.due ? 'some' : 'all';
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Checklist</h1>
        <button
          type="button"
          onClick={() => openSheet(null)}
          className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</div>
      )}

      <div className="flex w-fit gap-[2px] rounded-full bg-muted p-[3px]">
        {(['week', 'month'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={cn(
              'rounded-full px-3 py-1.5 font-sans text-[11px] font-semibold capitalize transition-colors',
              viewMode === mode ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {mode}
          </button>
        ))}
      </div>

      {viewMode === 'week' ? (
        <div className={cn('elevation-card p-[14px] transition-opacity', loading && 'opacity-60')}>
          <div className="mb-3 flex items-center justify-between">
            <span className="font-sans text-xs text-muted-foreground">
              {shortDate(weekDays[0], { month: 'short', day: 'numeric' })} – {shortDate(weekDays[6], { month: 'short', day: 'numeric' })}
            </span>
            <div className="flex gap-1.5">
              <NavButton label="Previous week" onClick={() => setWeekEnd(addDays(weekEnd, -7))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </NavButton>
              <NavButton
                label="Next week"
                disabled={weekEnd >= today}
                onClick={() => setWeekEnd(addDays(weekEnd, 7) > today ? today : addDays(weekEnd, 7))}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </NavButton>
            </div>
          </div>
          {weekItems.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No items this week</p>
          ) : (
            <div className="grid items-center gap-y-2" style={{ gridTemplateColumns: 'minmax(0,1fr) repeat(7, 30px)' }}>
              <span />
              {weekDays.map((d) => {
                const p = dayProgress(items, checks, d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg py-1',
                      d === selectedDate && 'bg-muted',
                      d === today && 'outline-dashed outline-1 outline-muted-foreground/60'
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground">{shortDate(d, { weekday: 'narrow' })}</span>
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{Number(d.slice(8))}</span>
                    <span className="font-mono text-[9px] tabular-nums text-muted-foreground">{p.due ? `${p.done}/${p.due}` : '–'}</span>
                  </button>
                );
              })}
              {weekItems.map((item) => (
                <Fragment key={item.id}>
                  <span className="truncate pr-2 text-sm text-foreground">{item.name}</span>
                  {weekDays.map((d) => {
                    const state = cellState(item, checks, d);
                    return (
                      <span key={d} className="flex h-6 items-center justify-center">
                        <span aria-label={`${item.name}, ${d}: ${state}`} className={CELL_CLASS[state]} />
                      </span>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className={cn('elevation-card flex flex-col gap-3.5 p-[15px] transition-opacity', loading && 'opacity-60')}>
          <div className="flex items-center justify-between">
            <div className="font-sans text-sm font-medium text-foreground">
              {shortDate(month, { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex gap-1.5">
              <NavButton label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </NavButton>
              <NavButton label="Next month" disabled={month >= monthStartOf(today)} onClick={() => shiftMonth(1)}>
                <ChevronRight className="h-3.5 w-3.5" />
              </NavButton>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] text-muted-foreground">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {monthCells.map((date, i) =>
              date ? (
                <button
                  key={date}
                  type="button"
                  disabled={date > today}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-lg font-mono text-xs tabular-nums disabled:opacity-30',
                    MONTH_CLASS[monthTone(date)],
                    date === today && 'outline-dashed outline-1 outline-muted-foreground/70',
                    date === selectedDate && 'ring-2 ring-foreground/60'
                  )}
                >
                  {Number(date.slice(8))}
                </button>
              ) : (
                <div key={`blank-${i}`} />
              )
            )}
          </div>
          <div className="flex items-center gap-4 pt-0.5 font-sans text-[10px] text-muted-foreground">
            {([['None', 'zero'], ['Some', 'some'], ['All', 'all']] as const).map(([label, tone]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={cn('h-2.5 w-2.5 rounded-sm', MONTH_CLASS[tone])} /> {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Day panel: tick/untick any past day, e.g. when you forgot to record it */}
      <div className="elevation-card flex flex-col gap-1 p-[14px]">
        <div className="flex items-baseline justify-between pb-1">
          <span className="text-sm font-medium text-foreground">
            {selectedDate === today ? 'Today' : shortDate(selectedDate, { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          {selectedProgress.due > 0 && (
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {selectedProgress.done}/{selectedProgress.due}
            </span>
          )}
        </div>
        {selectedDue.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled on this day</p>
        ) : (
          <div className="-mx-1 flex flex-col">
            {selectedDue.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                checked={isChecked(checks, item.id, selectedDate)}
                onToggle={() => toggle(item.id, selectedDate)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Items</div>
        {activeItems.length === 0 ? (
          <div className="elevation-card p-6 text-center text-sm text-muted-foreground">No items yet. Tap Add to create your first one.</div>
        ) : (
          <div className="elevation-card divide-y divide-border overflow-hidden p-0">
            {activeItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openSheet(item)}
                className="flex w-full items-center justify-between gap-3 px-[14px] py-3 text-left"
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm text-foreground">{item.name}</span>
                  {item.note && <span className="block break-words text-xs text-muted-foreground">{item.note}</span>}
                </span>
                <span className="flex-none font-mono text-[11px] text-muted-foreground">{scheduleLabel(item.weekdays)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <ChecklistItemSheet
        open={sheetOpen}
        item={sheetItem}
        onOpenChange={setSheetOpen}
        onSave={(values) => saveItem(values, sheetItem?.id)}
        onArchive={archiveItem}
      />
    </div>
  );
};

export default Checklist;
