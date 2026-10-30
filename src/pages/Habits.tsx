import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, ChevronLeft, ChevronRight, Loader2, Pause, Plus } from 'lucide-react';
import { closeOnBack } from '@/lib/backButton';
import { cn } from '@/lib/utils';
import { addDays, categoryGroups, categoryNames, dayProgress, isDueOn, type HabitValues } from '@/lib/habits';
import { useHabits, useLocalToday } from '@/hooks/useHabits';
import {
  getReminderSettings, remindersSupported, saveReminderSettings, syncReminders, type ReminderSettings,
} from '@/lib/habitReminders';
import CategoryCard, { CategoryRenameSheet } from '@/components/habits/CategoryCard';
import CategoryEditList from '@/components/habits/CategoryEditList';
import HabitRow from '@/components/habits/HabitRow';
import HabitSheet from '@/components/habits/HabitSheet';
import HabitStats from '@/components/habits/HabitStats';
import HabitStarters from '@/components/habits/HabitStarters';
import HabitEditList, { initialOrder, orderToSave, withRestored } from '@/components/habits/HabitEditList';
import HabitReminderSheet from '@/components/habits/HabitReminderSheet';
import { MonthHeatmap, WeekGrid, fmtMonthShift, monthStartOf, shortDate } from '@/components/habits/HabitHistory';
import { Ring, StateMark } from '@/components/habits/habitUi';
import MenuButton from '@/components/MenuButton';
import Segmented from '@/components/Segmented';

// Seeds that fall across the screen when the last habit of the day is ticked.
const SEED_COLORS = ['--chart-fiber', '--chart-carbs', '--chart-fat', '--chart-protein', '--foreground'];
// The longest seed (1,900 ms + 300 ms delay) is gone by SEEDS_MS, when the layer is removed.
const SEEDS_MS = 2300;
const SEEDS = Array.from({ length: 20 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  background: `hsl(var(${SEED_COLORS[i % 5]}))`,
  '--drift': `${((i * 53) % 120) - 60}px`,
  '--spin': `${((i * 97) % 720) - 360}deg`,
  '--dur': `${1400 + ((i * 71) % 500)}ms`,
  '--delay': `${(i * 43) % 300}ms`,
})) as CSSProperties[];

// Seeds fall at most once a day, even if the last habit is unticked and ticked again.
const SEEDS_KEY = 'habits-seeds-day';
const seedsShownOn = (day: string) => {
  try {
    return localStorage.getItem(SEEDS_KEY) === day;
  } catch {
    return false;
  }
};
const markSeedsShown = (day: string) => {
  try {
    localStorage.setItem(SEEDS_KEY, day);
  } catch {
    // Storage blocked: worst case the seeds can fall again today.
  }
};

// Folded categories are remembered on this phone; "" stands for the Other group.
const CLOSED_KEY = 'habits-closed-categories';
const readClosed = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CLOSED_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const saveClosed = (closed: string[]) => {
  try {
    localStorage.setItem(CLOSED_KEY, JSON.stringify(closed));
  } catch {
    // Storage blocked: categories just reopen next visit.
  }
};

const Habits = () => {
  const navigate = useNavigate();
  const today = useLocalToday();
  const [tab, setTab] = useState<'today' | 'stats'>('today');
  const [selected, setSelected] = useState(today);
  const [weekEnd, setWeekEnd] = useState(today);
  const [month, setMonth] = useState(() => monthStartOf(today));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reminder, setReminder] = useState(getReminderSettings);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<string[] | null>(null); // non-null = editing the list
  const [closed, setClosed] = useState(readClosed);
  const [renaming, setRenaming] = useState<{ name: string | null } | null>(null);
  const [editCategories, setEditCategories] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekEnd, i - 6));
  // One range covers the strip, the grids, the selected day and a year of history for streaks and stats.
  const from = [weekDays[0], month, selected, addDays(today, -364)].sort()[0];
  const { habits, idx, loading, error, writeLog, saveHabit, addHabits, renameCategory, moveToCategory, setArchived, reorderHabits } = useHabits(from, today);

  // Android Back leaves the category editor rather than the Habits page.
  useEffect(() => (editCategories ? closeOnBack(() => setEditCategories(false)) : undefined), [editCategories]);

  const active = habits.filter((h) => !h.archived_at);
  const progress = dayProgress(habits, idx, selected, today);
  const dueHabits = active.filter((h) => isDueOn(h, idx, selected, today));

  // When the last of today's habits gets ticked, today's ring in the strip pops once.
  const todayP = dayProgress(habits, idx, today, today);
  const todayDone = todayP.due > 0 && todayP.done === todayP.due;
  const wasDone = useRef<boolean | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [seeds, setSeeds] = useState(false);
  useEffect(() => {
    if (loading) return;
    if (wasDone.current === false && todayDone) {
      setCelebrate(true);
      const fall = !seedsShownOn(today);
      if (fall) {
        markSeedsShown(today);
        setSeeds(true);
      }
      const t = window.setTimeout(() => setCelebrate(false), 1600);
      const s = fall ? window.setTimeout(() => setSeeds(false), SEEDS_MS) : 0;
      wasDone.current = todayDone;
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(s);
      };
    }
    wasDone.current = todayDone;
  }, [todayDone, loading, today]);

  const changeReminder = (next: ReminderSettings) => {
    setReminder(next);
    saveReminderSettings(next);
    syncReminders(habits, idx);
  };

  const select = (date: string) => {
    setSelected(date);
    if (date < weekDays[0] || date > weekEnd) setWeekEnd(addDays(date, 3) > today ? today : addDays(date, 3));
  };
  const shiftWeek = (n: number) => {
    const next = addDays(weekEnd, 7 * n);
    setWeekEnd(next > today ? today : next);
  };

  const toggleCategory = (name: string | null) => {
    const key = name ?? '';
    const next = closed.includes(key) ? closed.filter((c) => c !== key) : [...closed, key];
    setClosed(next);
    saveClosed(next);
  };

  const finishEditing = async () => {
    if (editOrder && (await reorderHabits(orderToSave(editOrder)))) setEditOrder(null);
  };

  if (loading && habits.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const header = (
    <div className="flex h-14 items-center gap-1">
      <MenuButton />
      <h1 className="ml-2 flex-1 font-display text-2xl font-semibold tracking-tight">{editCategories ? 'Edit categories' : editOrder ? 'Edit list' : 'Habits'}</h1>
      {editOrder || editCategories ? (
        <button type="button" onClick={() => (editCategories ? setEditCategories(false) : finishEditing())} className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
          Done
        </button>
      ) : (
        <>
          {remindersSupported() && (
            <button
              type="button"
              onClick={() => setReminderOpen(true)}
              aria-label={reminder.enabled ? `Daily reminder on at ${reminder.time}` : 'Daily reminder off'}
              className={cn('flex h-11 w-11 items-center justify-center rounded-full', reminder.enabled ? 'text-primary' : 'text-muted-foreground')}
            >
              <Bell className={cn('h-5 w-5', reminder.enabled && 'fill-current')} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            aria-label="New habit"
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <Plus className="h-5 w-5" strokeWidth={2.4} />
          </button>
        </>
      )}
    </div>
  );

  const sheets = (
    <>
      <HabitSheet open={sheetOpen} habit={null} categories={categoryNames(habits)} onOpenChange={setSheetOpen} onSave={(values: HabitValues) => saveHabit(values)} />
      <HabitReminderSheet open={reminderOpen} onOpenChange={setReminderOpen} settings={reminder} onChange={changeReminder} />
    </>
  );

  if (habits.length === 0) {
    return (
      <div className="space-y-3.5">
        {header}
        {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</div>}
        {!error && <HabitStarters onAdd={addHabits} onCreate={() => setSheetOpen(true)} />}
        {sheets}
      </div>
    );
  }

  if (editCategories) {
    return (
      <div className="space-y-3.5">
        {header}
        <CategoryEditList habits={habits} onRename={renameCategory} onCreate={moveToCategory} />
      </div>
    );
  }

  if (editOrder) {
    return (
      <div className="space-y-3.5">
        {header}
        <HabitEditList
          habits={habits}
          order={editOrder}
          onOrderChange={setEditOrder}
          onRestore={async (id) => {
            const habit = habits.find((h) => h.id === id);
            if (habit && (await setArchived(id, false))) setEditOrder((prev) => prev && withRestored(prev, habit));
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {header}
      {seeds && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {SEEDS.map((sd, i) => (
            <span key={i} className="motion-seed absolute -top-5 h-3.5 w-2 rounded-full" style={sd} />
          ))}
        </div>
      )}

      {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">{error}</div>}

      <Segmented label="Habits view" options={[['today', 'Today'], ['stats', 'Stats']]} value={tab} onChange={setTab} />

      {tab === 'stats' ? (
        <HabitStats habits={habits} idx={idx} today={today} />
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="-mx-2.5 flex items-center">
              <button type="button" aria-label="Previous week" onClick={() => shiftWeek(-1)} className="flex h-11 w-11 items-center justify-center rounded-full">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex-1 text-center">
                <div className="font-display text-base font-semibold">{shortDate(selected, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                {selected === today ? (
                  <div className="text-[12px] font-semibold text-primary">Today</div>
                ) : (
                  <button type="button" onClick={() => select(today)} className="text-[12px] font-semibold text-primary">
                    Back to today
                  </button>
                )}
              </div>
              <button
                type="button"
                aria-label="Next week"
                disabled={weekEnd >= today}
                onClick={() => shiftWeek(1)}
                className="flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-30"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
            <div className="flex justify-between">
              {weekDays.map((d) => {
                const p = dayProgress(habits, idx, d, today);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelected(d)}
                    aria-label={`${shortDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}, ${p.pct} percent complete`}
                    aria-pressed={d === selected}
                    className={cn(
                      'flex h-[70px] w-[46px] flex-col items-center justify-center gap-[5px] rounded-[14px]',
                      d === selected && 'bg-card shadow-sm ring-2 ring-primary'
                    )}
                  >
                    <span className="text-[12px] font-semibold text-muted-foreground">{shortDate(d, { weekday: 'narrow' })}</span>
                    {p.due > 0 && p.done === p.due ? (
                      <span
                        className={cn(
                          'flex h-[22px] w-[22px] items-center justify-center rounded-full bg-chart-fiber text-background',
                          celebrate && d === today && 'motion-celebrate'
                        )}
                      >
                        <Check className={cn('h-3 w-3', celebrate && d === today && 'motion-draw')} strokeWidth={3.5} />
                      </span>
                    ) : (
                      <Ring value={p.pct / 100} size={22} stroke={4} />
                    )}
                    <span className="font-mono text-[13px] font-medium">{Number(d.slice(8))}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="elevation-card flex items-center gap-5 rounded-2xl p-[18px]">
            <Ring value={progress.pct / 100} size={124} stroke={13} label={`${progress.pct} percent of habits complete`}>
              <span className="text-center">
                <span className="block font-mono text-[32px] font-semibold leading-none">
                  {progress.pct}
                  <span className="text-base">%</span>
                </span>
                <span className="mt-1 block text-[12px] font-semibold text-muted-foreground">
                  {selected === today ? 'today' : shortDate(selected, { weekday: 'short' })}
                </span>
              </span>
            </Ring>
            <div className="flex flex-1 flex-col gap-2.5 text-[13px]">
              <span className="flex items-center gap-2"><StateMark state="done" size={16} /><span className="font-mono font-semibold">{progress.done}</span><span className="text-muted-foreground">done</span></span>
              {progress.partial > 0 && <span className="flex items-center gap-2"><StateMark state="partial" size={16} /><span className="font-mono font-semibold">{progress.partial}</span><span className="text-muted-foreground">in progress</span></span>}
              {progress.toGo > 0 && <span className="flex items-center gap-2"><StateMark state="pending" size={16} /><span className="font-mono font-semibold">{progress.toGo}</span><span className="text-muted-foreground">to go</span></span>}
              {progress.missed > 0 && <span className="flex items-center gap-2"><StateMark state="missed" size={16} /><span className="font-mono font-semibold">{progress.missed}</span><span className="text-muted-foreground">missed</span></span>}
              {progress.skipped > 0 && (
                <span className="flex items-center gap-2">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full border-[1.5px] border-dashed border-chart-water text-chart-water"><Pause className="h-2 w-2" strokeWidth={4} /></span>
                  <span className="font-mono font-semibold">{progress.skipped}</span><span className="text-muted-foreground">skipped</span>
                </span>
              )}
            </div>
          </section>

          {dueHabits.length === 0 && <div className="elevation-card rounded-2xl p-6 text-center text-sm text-muted-foreground">Nothing scheduled on this day</div>}
          {categoryGroups(dueHabits).map(({ name, habits: group }) => (
            <CategoryCard
              key={name ?? ''}
              name={name}
              done={group.filter((h) => dayProgress([h], idx, selected, today).done === 1).length}
              total={group.length}
              closed={closed.includes(name ?? '')}
              onToggle={() => toggleCategory(name)}
              onRename={() => setRenaming({ name })}
            >
              {group.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  idx={idx}
                  date={selected}
                  today={today}
                  onWrite={(next) => writeLog(h.id, selected, next)}
                  onOpen={() => navigate(`/habits/${h.id}`)}
                />
              ))}
            </CategoryCard>
          ))}
          <div className="flex justify-center">
            <button type="button" onClick={() => setEditCategories(true)} className="h-11 px-4 text-[13px] font-semibold text-primary">
              Edit categories
            </button>
            {habits.length > 1 && (
              <button type="button" onClick={() => setEditOrder(initialOrder(habits))} className="h-11 px-4 text-[13px] font-semibold text-primary">
                Reorder & archived
              </button>
            )}
          </div>

          <WeekGrid habits={active} idx={idx} days={weekDays} today={today} selected={selected} onSelect={setSelected} onShift={shiftWeek} />
          <MonthHeatmap
            habits={habits}
            idx={idx}
            month={month}
            today={today}
            selected={selected}
            onSelect={select}
            onShift={(n) => setMonth(fmtMonthShift(month, n))}
          />
        </>
      )}

      {sheets}
      {renaming && (
        <CategoryRenameSheet
          name={renaming.name}
          count={active.filter((h) => (h.category ?? null) === renaming.name).length}
          onClose={() => setRenaming(null)}
          onSave={(next) => renameCategory(renaming.name, next)}
        />
      )}
    </div>
  );
};

export default Habits;
