import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Archive, ArrowLeft, Bell, Check, ChevronLeft, ChevronRight, Flame, Loader2, Minus, Pause, Pencil, Plus, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  addDays, categoryNames, dayState, dayValue, habitRate, habitStreaks, logOn, scheduleLabel, targetLabel, weekStart,
  type DayState,
} from '@/lib/habits';
import { useHabits, useLocalToday, type LogPatch } from '@/hooks/useHabits';
import HabitSheet from '@/components/habits/HabitSheet';
import { NavButton, fmtMonthShift, monthStartOf, shortDate } from '@/components/habits/HabitHistory';
import { HabitTile, STATE_WORD, SectionLabel, StateMark, TIME_LABEL, colorStyle } from '@/components/habits/habitUi';

const SKIP_REASONS = ['Sick', 'Travel', 'Rest day', 'Other'];
const Tag = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex h-[26px] items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs">{children}</span>
);

const HabitDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const today = useLocalToday();
  const { habits, idx, logs, loading, writeLog, saveHabit, setArchived, deleteHabits } = useHabits(addDays(today, -370), today);
  const [editOpen, setEditOpen] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [month, setMonth] = useState(() => monthStartOf(today));
  const [historyCount, setHistoryCount] = useState(8);
  const habit = habits.find((h) => h.id === id);

  if (loading && !habit) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!habit) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-muted-foreground">This habit no longer exists.</p>
        <button type="button" onClick={() => navigate('/habits')} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Back to habits
        </button>
      </div>
    );
  }

  const log = logOn(idx, habit.id, today);
  const state = dayState(habit, idx, today, today);
  const note = log?.note ?? null;
  const count = log?.status === 'done' ? (log.count ?? 0) : 0;
  const write = (next: LogPatch | null, date = today) => writeLog(habit.id, date, next);
  const setCount = (n: number) => write(n > 0 || note ? { status: 'done', count: Math.max(0, n), note } : null);
  const streaks = habitStreaks(habit, idx, today);
  const rate = habitRate(habit, idx, today);
  const style = colorStyle(habit.color);

  // Year heatmap: 53 Monday-start weeks ending this week.
  const yearStart = addDays(weekStart(today), -52 * 7);
  const year = Array.from({ length: 53 * 7 }, (_, i) => {
    const date = addDays(yearStart, i);
    const s = dayState(habit, idx, date, today);
    const level = s === 'done' ? 4 : s === 'partial' ? Math.max(1, Math.round(dayValue(habit, idx, date, today) * 4)) : 0;
    return { date, s, level };
  });
  const daysHit = year.filter((c) => c.s === 'done').length;
  const monthLabels = Array.from({ length: 53 }, (_, w) => {
    const d = addDays(yearStart, w * 7);
    return d.slice(8) <= '07' ? shortDate(d, { month: 'short' }) : '';
  });

  // Month calendar.
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const monthDays = Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month.slice(0, 8)}${String(i + 1).padStart(2, '0')}`);

  // Trend: the last 8 weeks. Count habits show the average amount per due day; others the completion rate.
  const trend = Array.from({ length: 8 }, (_, i) => {
    const start = addDays(weekStart(today), -7 * (7 - i));
    let sum = 0;
    let n = 0;
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, d);
      const s = dayState(habit, idx, date, today);
      if (s === 'off' || s === 'skipped' || (s === 'pending' && date === today) || date > today) continue;
      n++;
      sum += habit.kind === 'count' ? (logOn(idx, habit.id, date)?.count ?? 0) : s === 'done' ? 100 : 0;
    }
    return { start, value: n ? sum / n : null, open: i === 7 };
  });
  const trendMax = habit.kind === 'count' ? Math.max(habit.target, ...trend.map((t) => t.value ?? 0)) : 100;

  const history = logs
    .filter((l) => l.item_id === habit.id)
    .sort((a, b) => b.checked_date.localeCompare(a.checked_date));

  const historyState = (date: string): DayState => dayState(habit, idx, date, today);
  const editNote = (date: string) => {
    const current = logOn(idx, habit.id, date);
    if (!current) return;
    const next = window.prompt('Note for this day', current.note ?? '');
    if (next !== null) write({ status: current.status, count: current.count, note: next.trim() || null }, date);
  };

  const confirmThen = async (question: string, action: () => Promise<boolean>) => {
    if (window.confirm(question) && (await action())) navigate('/habits');
  };

  return (
    <div className="space-y-3.5" style={style}>
      <div className="-mx-2 flex h-14 items-center">
        <button type="button" aria-label="Back to habits" onClick={() => navigate('/habits')} className="flex h-11 w-11 items-center justify-center rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex-1" />
        <button type="button" aria-label="Edit habit" onClick={() => setEditOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full">
          <Pencil className="h-[18px] w-[18px]" />
        </button>
      </div>

      <div className="flex items-center gap-3.5">
        <HabitTile habit={habit} size={56} />
        <div className="min-w-0">
          <h1 className="text-[26px] font-semibold leading-tight">{habit.name}</h1>
          <div className="text-[13px] text-muted-foreground">
            {[targetLabel(habit) && `${targetLabel(habit)} a day`, habit.kind === 'avoid' && 'Avoid', habit.category].filter(Boolean).join(' · ') || habit.note}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Tag>{habit.kind === 'check' ? 'Yes / no' : habit.kind === 'count' ? 'Count' : 'Avoid'}</Tag>
        <Tag>{scheduleLabel(habit)}</Tag>
        <Tag>{TIME_LABEL[habit.time_of_day]}</Tag>
        {habit.reminder_times.length > 0 && (
          <Tag>
            <Bell className="h-3 w-3" />
            <span className="font-mono">{habit.reminder_times.join(' · ')}</span>
          </Tag>
        )}
      </div>
      {habit.note && (habit.category || habit.kind !== 'check') && <p className="text-[13px] text-muted-foreground">{habit.note}</p>}

      {!habit.archived_at && (
        <section className="elevation-card space-y-3 rounded-2xl p-3.5">
          {state === 'skipped' ? (
            <div className="flex items-center gap-3">
              <StateMark state="skipped" size={28} />
              <div className="flex-1">
                <div className="font-medium">Skipped today</div>
                <div className="text-xs text-muted-foreground">{note ?? 'No reason given'} · streak kept</div>
              </div>
              <button type="button" onClick={() => write(null)} className="h-11 rounded-full px-4 text-[13px] font-semibold text-primary">Undo</button>
            </div>
          ) : (
            <>
              {habit.kind === 'count' && (
                <>
                  <div className="flex items-center gap-2.5">
                    <button type="button" aria-label={`Remove one ${habit.unit ?? ''}`} disabled={count === 0} onClick={() => setCount(count - 1)} className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-muted disabled:opacity-40">
                      <Minus className="h-5 w-5" strokeWidth={2.6} />
                    </button>
                    <div className="flex-1 text-center">
                      <SectionLabel>Today</SectionLabel>
                      <div className="font-mono text-[34px] font-semibold leading-tight">
                        {count.toLocaleString()}
                        <span className="text-xl text-muted-foreground"> / {habit.target.toLocaleString()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{habit.unit}</div>
                    </div>
                    <button type="button" aria-label={`Add one ${habit.unit ?? ''}`} onClick={() => setCount(count + 1)} className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Plus className="h-5 w-5" strokeWidth={2.6} />
                    </button>
                  </div>
                  {habit.target <= 16 ? (
                    <div className="flex gap-1" role="img" aria-label={`${count} of ${habit.target}`}>
                      {Array.from({ length: habit.target }, (_, i) => (
                        <span key={i} className={cn('h-2 flex-1 rounded', i < count ? (state === 'done' ? 'bg-chart-fiber' : 'bg-[color-mix(in_srgb,var(--c)_78%,hsl(var(--foreground)))]') : 'bg-muted')} />
                      ))}
                    </div>
                  ) : (
                    <div className="h-2 overflow-hidden rounded bg-muted">
                      <div className={cn('h-full rounded', state === 'done' ? 'bg-chart-fiber' : 'bg-[color-mix(in_srgb,var(--c)_78%,hsl(var(--foreground)))]')} style={{ width: `${Math.min(100, (count / habit.target) * 100)}%` }} />
                    </div>
                  )}
                </>
              )}
              {habit.kind === 'check' && (
                <button
                  type="button"
                  onClick={() => write(state === 'done' ? null : { status: 'done', count: null, note })}
                  className={cn(
                    'flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold',
                    state === 'done' ? 'bg-chart-fiber text-white' : 'border-2 border-border text-foreground'
                  )}
                >
                  <Check className="h-5 w-5" strokeWidth={3} />
                  {state === 'done' ? 'Done today · tap to undo' : 'Mark done today'}
                </button>
              )}
              {habit.kind === 'avoid' && (
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Today">
                  {(['done', 'slipped'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={log?.status === s}
                      onClick={() => write(log?.status === s ? null : { status: s, count: null, note })}
                      className={cn(
                        'flex h-[52px] items-center justify-center gap-1.5 rounded-full border-[1.5px] text-[15px] font-semibold',
                        log?.status === s ? (s === 'done' ? 'border-chart-fiber bg-chart-fiber text-white' : 'border-2 border-primary bg-primary/10 text-primary') : 'border-border'
                      )}
                    >
                      {s === 'done' ? <Check className="h-4 w-4" strokeWidth={3} /> : <X className="h-4 w-4" strokeWidth={3} />}
                      {s === 'done' ? 'Held' : 'Slipped'}
                    </button>
                  ))}
                </div>
              )}
              {skipping ? (
                <div className="space-y-2">
                  <div className="text-[13px] text-muted-foreground">Why skip today? Your streak stays safe.</div>
                  <div className="flex flex-wrap gap-2">
                    {SKIP_REASONS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setSkipping(false);
                          write({ status: 'skipped', count: null, note: r === 'Other' ? null : r.toLowerCase() });
                        }}
                        className="h-11 rounded-full border border-border px-4 text-[13px] font-medium"
                      >
                        {r}
                      </button>
                    ))}
                    <button type="button" onClick={() => setSkipping(false)} className="h-11 px-3 text-[13px] text-muted-foreground">Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setSkipping(true)} className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-dashed border-border text-[13px] font-medium text-muted-foreground">
                  <Pause className="h-3.5 w-3.5" strokeWidth={2.6} />
                  Skip today · streak stays safe
                </button>
              )}
            </>
          )}
        </section>
      )}

      <section className="grid grid-cols-3 gap-2">
        <div className="elevation-card rounded-2xl p-3">
          <SectionLabel className="text-[10px]">Current</SectionLabel>
          <div className="mt-1 flex items-baseline gap-1">
            <Flame className="h-[18px] w-[18px] self-center text-chart-carbs" />
            <span className="font-mono text-2xl font-semibold">{streaks.current}</span>
            <span className="text-xs text-muted-foreground">{streaks.unit}</span>
          </div>
        </div>
        <div className="elevation-card rounded-2xl p-3">
          <SectionLabel className="text-[10px]">Best</SectionLabel>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="font-mono text-2xl font-semibold">{streaks.best}</span>
            <span className="text-xs text-muted-foreground">{streaks.unit}</span>
          </div>
        </div>
        <div className="elevation-card rounded-2xl p-3">
          <SectionLabel className="text-[10px]">30 days</SectionLabel>
          <div className="mt-1 flex items-baseline gap-0.5">
            <span className="font-mono text-2xl font-semibold">{rate ?? '–'}</span>
            {rate !== null && <span className="text-xs text-muted-foreground">%</span>}
          </div>
        </div>
      </section>

      <section className="elevation-card rounded-2xl p-3.5">
        <div className="mb-2.5 flex items-baseline justify-between">
          <SectionLabel>Last 12 months</SectionLabel>
          <span className="font-mono text-xs">{daysHit} {daysHit === 1 ? 'day' : 'days'} hit</span>
        </div>
        <div className="overflow-x-auto">
          <div className="grid w-max grid-flow-col gap-px font-mono text-[9px] text-muted-foreground" style={{ gridTemplateColumns: 'repeat(53, 5px)' }}>
            {monthLabels.map((l, i) => <span key={i} className="w-[5px] overflow-visible whitespace-nowrap">{l}</span>)}
          </div>
          <div
            className="mt-1 grid w-max grid-flow-col gap-px"
            style={{ gridTemplateRows: 'repeat(7, 5px)', gridAutoColumns: '5px' }}
            role="img"
            aria-label={`${daysHit} days hit in the last 12 months`}
          >
            {year.map((c) => (
              <span
                key={c.date}
                className={cn(
                  'rounded-[1px]',
                  c.s === 'skipped' ? 'ring-1 ring-inset ring-chart-water' : c.s === 'off' && c.date > today ? '' : 'bg-muted'
                )}
                style={c.level ? { background: `color-mix(in srgb, hsl(var(--chart-fiber)) ${[0, 30, 55, 80, 100][c.level]}%, hsl(var(--muted)))` } : undefined}
              />
            ))}
          </div>
        </div>
        <div className="mt-2.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <span>Less</span>
          {[0, 30, 55, 80, 100].map((p) => (
            <span key={p} className="h-[9px] w-[9px] rounded-[1px]" style={{ background: `color-mix(in srgb, hsl(var(--chart-fiber)) ${p}%, hsl(var(--muted)))` }} />
          ))}
          <span>Goal</span>
          <span className="ml-2.5 h-[9px] w-[9px] rounded-[1px] ring-1 ring-inset ring-chart-water" />
          <span>Skipped</span>
        </div>
      </section>

      <section className="elevation-card rounded-2xl px-3.5 pb-3.5 pt-1.5">
        <div className="flex items-center justify-between">
          <SectionLabel>{shortDate(month, { month: 'long', year: 'numeric' })}</SectionLabel>
          <div className="flex">
            <NavButton label="Previous month" onClick={() => setMonth(fmtMonthShift(month, -1))}><ChevronLeft className="h-[18px] w-[18px]" /></NavButton>
            <NavButton label="Next month" disabled={month >= monthStartOf(today)} onClick={() => setMonth(fmtMonthShift(month, 1))}><ChevronRight className="h-[18px] w-[18px]" /></NavButton>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }, (_, i) => <span key={`b${i}`} />)}
          {monthDays.map((date) => {
            const s = historyState(date);
            return (
              <span
                key={date}
                role="img"
                aria-label={`${shortDate(date, { month: 'long', day: 'numeric' })}: ${STATE_WORD[s]}`}
                className={cn('flex h-11 flex-col items-center justify-center gap-[3px] rounded-[10px] font-mono text-[11px] text-muted-foreground', date === today && 'text-foreground ring-2 ring-inset ring-primary')}
              >
                {Number(date.slice(8))}
                {date <= today ? <StateMark state={s} size={16} /> : <span className="h-4" />}
              </span>
            );
          })}
        </div>
      </section>

      <section className="elevation-card rounded-2xl p-3.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel>{habit.kind === 'count' ? 'Weekly average' : 'Weekly completion'}</SectionLabel>
          <span className="text-xs text-muted-foreground">{habit.kind === 'count' ? `${habit.unit ?? 'per'} / day` : '% of due days'}</span>
        </div>
        <div className="relative mt-3 flex h-[110px] items-end gap-2" role="img" aria-label={`Last 8 weeks: ${trend.map((t) => (t.value === null ? 'none' : Math.round(t.value * 10) / 10)).join(', ')}`}>
          {habit.kind === 'count' && (
            <span className="absolute inset-x-0 border-t border-dashed border-muted-foreground" style={{ bottom: `${(habit.target / trendMax) * 90}px` }}>
              <span className="absolute -top-4 right-0 font-mono text-[10px] text-muted-foreground">goal {habit.target.toLocaleString()}</span>
            </span>
          )}
          {trend.map((t) => (
            <div key={t.start} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] font-semibold">{t.value === null ? '' : habit.kind === 'count' ? (t.value >= 100 ? Math.round(t.value).toLocaleString() : t.value.toFixed(1)) : Math.round(t.value)}</span>
              <span
                className={cn('w-full rounded', t.open ? 'bg-[color-mix(in_srgb,var(--c)_40%,hsl(var(--muted)))]' : 'bg-[color-mix(in_srgb,var(--c)_78%,hsl(var(--foreground)))]')}
                style={{ height: t.value === null ? 0 : `${Math.max(2, (t.value / trendMax) * 90)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {trend.map((t) => (
            <span key={t.start} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">{t.open ? 'now' : shortDate(t.start, { day: 'numeric', month: 'short' })}</span>
          ))}
        </div>
      </section>

      <section className="elevation-card rounded-2xl px-3.5 py-1">
        <div className="pb-0.5 pt-2.5"><SectionLabel>History &amp; notes</SectionLabel></div>
        {history.length === 0 && <p className="py-3 text-sm text-muted-foreground">Nothing logged yet.</p>}
        {history.slice(0, historyCount).map((l) => {
          const s = historyState(l.checked_date);
          const value =
            l.status === 'skipped' ? 'Skipped' : l.status === 'slipped' ? 'Slipped' : habit.kind === 'count' ? `${(l.count ?? 0).toLocaleString()} / ${habit.target.toLocaleString()}` : habit.kind === 'avoid' ? 'Held' : 'Done';
          return (
            <button key={l.checked_date} type="button" onClick={() => editNote(l.checked_date)} className="flex w-full items-start gap-3 border-t border-border py-3 text-left first-of-type:border-0">
              <span className="mt-0.5"><StateMark state={s} size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex justify-between gap-2">
                  <span className="font-medium">{l.checked_date === today ? 'Today' : shortDate(l.checked_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className={cn('font-mono text-xs', l.status === 'skipped' && 'font-sans font-semibold text-chart-water', l.status === 'slipped' && 'font-sans font-semibold text-primary')}>{value}</span>
                </span>
                <span className="block text-[13px] text-muted-foreground">{l.note ?? <span className="opacity-60">Add a note</span>}</span>
              </span>
            </button>
          );
        })}
        {history.length > historyCount && (
          <button type="button" onClick={() => setHistoryCount((n) => n + 20)} className="h-11 w-full border-t border-border text-[13px] font-semibold text-primary">
            Show more
          </button>
        )}
      </section>

      <div className="space-y-2 pt-1">
        <button type="button" onClick={() => setEditOpen(true)} className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold">
          <Pencil className="h-4 w-4" /> Edit habit
        </button>
        <div className="grid grid-cols-2 gap-2">
          {habit.archived_at ? (
            <button type="button" onClick={() => setArchived(habit.id, false)} className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold">
              <Archive className="h-4 w-4" /> Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={() => confirmThen(`Archive "${habit.name}"? It leaves your daily list; its history is kept.`, () => setArchived(habit.id, true))}
              className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold"
            >
              <Archive className="h-4 w-4" /> Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => confirmThen(`Delete "${habit.name}" and all its history? This can't be undone.`, () => deleteHabits([habit.id]))}
            className="flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold text-primary"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
        <p className="text-center text-xs text-muted-foreground">Archive hides it and keeps its history. Delete erases it.</p>
      </div>

      <HabitSheet open={editOpen} habit={habit} categories={categoryNames(habits)} onOpenChange={setEditOpen} onSave={(values) => saveHabit(values, habit.id)} />
    </div>
  );
};

export default HabitDetail;
