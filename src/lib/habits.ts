// Pure habit rules -- no React, no Supabase. `date` is always a local YYYY-MM-DD day.
// Stored in the checklist_items / checklist_checks tables (the habit tracker grew out of the checklist).
import { fmtLocalDate } from './utils';

export type HabitKind = 'check' | 'count' | 'avoid';
export type HabitSchedule = 'weekdays' | 'per_week' | 'interval';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type HabitColor = 'red' | 'orange' | 'amber' | 'sky' | 'violet';
export type LogStatus = 'done' | 'skipped' | 'slipped';

export interface Habit {
  id: string;
  name: string;
  note: string | null;
  weekdays: number[]; // 0 = Sun … 6 = Sat; used when schedule = 'weekdays'
  position: number;
  created_at: string;
  archived_at: string | null;
  kind: HabitKind;
  target: number; // count habits: amount per day; otherwise 1
  unit: string | null;
  schedule: HabitSchedule;
  per_week: number | null;
  interval_days: number | null;
  icon: string;
  color: HabitColor;
  category: string | null;
  time_of_day: TimeOfDay;
  reminder_times: string[]; // 'HH:MM'
}

// One row per habit per day. No row = nothing recorded.
export interface HabitLog {
  item_id: string;
  checked_date: string;
  status: LogStatus;
  count: number | null;
  note: string | null;
}

export type HabitValues = Omit<Habit, 'id' | 'position' | 'created_at' | 'archived_at'>;

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
export const TIMES_OF_DAY: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];
export const COLORS: HabitColor[] = ['red', 'orange', 'amber', 'sky', 'violet'];

/** Category names in the order their first habit appears. */
export const categoryNames = (habits: Pick<Habit, 'category'>[]) =>
  [...new Set(habits.flatMap((h) => (h.category ? [h.category] : [])))];

/** Habits by category, keeping their order; those without one (name null) come last. */
export const categoryGroups = <H extends Pick<Habit, 'category'>>(habits: H[]) => {
  const groups = categoryNames(habits).map((name) => ({ name: name as string | null, habits: habits.filter((h) => h.category === name) }));
  const other = habits.filter((h) => !h.category);
  return other.length ? [...groups, { name: null, habits: other }] : groups;
};

// ---------- dates ----------

const localDay = (date: string) => new Date(`${date}T00:00:00`);
const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

export const weekdayOf = (date: string) => localDay(date).getDay();

export const addDays = (date: string, n: number) => {
  const d = localDay(date);
  d.setDate(d.getDate() + n);
  return fmtLocalDate(d);
};

const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);

// Monday of the week containing `date`.
export const weekStart = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));

const firstDayOf = (habit: Habit) => fmtLocalDate(new Date(habit.created_at));

// ---------- logs ----------

export type LogIndex = Map<string, HabitLog>;
const key = (itemId: string, date: string) => `${itemId}|${date}`;
export const indexLogs = (logs: HabitLog[]): LogIndex => new Map(logs.map((l) => [key(l.item_id, l.checked_date), l]));
export const logOn = (idx: LogIndex, itemId: string, date: string) => idx.get(key(itemId, date));

// ---------- schedule ----------

// Exists on `date`: created on/before it, not yet archived.
export const isActiveOn = (habit: Habit, date: string) =>
  date >= firstDayOf(habit) && (!habit.archived_at || date < fmtLocalDate(new Date(habit.archived_at)));

// Fixed-schedule habits: is `date` one of its days? (per_week habits can be done any day.)
const isScheduled = (habit: Habit, date: string) => {
  if (habit.schedule === 'interval') return daysBetween(firstDayOf(habit), date) % (habit.interval_days ?? 1) === 0;
  if (habit.schedule === 'per_week') return true;
  return habit.weekdays.includes(weekdayOf(date));
};

// Did the log meet the habit on that day? (Avoid habits: an unmarked past day counts as held.)
const metOn = (habit: Habit, log: HabitLog | undefined, date: string, today: string) => {
  if (habit.kind === 'avoid') return log ? log.status === 'done' : date < today;
  if (!log || log.status !== 'done') return false;
  return habit.kind === 'count' ? (log.count ?? 0) >= habit.target : true;
};

// Done days and target for the Monday-start week containing `date` (per_week habits).
// Skipped days lower the target, so a sick day doesn't make the week impossible.
export const weekProgress = (habit: Habit, idx: LogIndex, date: string, today: string) => {
  const start = weekStart(date);
  let done = 0;
  let skipped = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (d > today || !isActiveOn(habit, d)) continue;
    const log = logOn(idx, habit.id, d);
    if (log?.status === 'skipped') skipped++;
    else if (habit.kind !== 'avoid' && metOn(habit, log, d, today)) done++;
  }
  return { done, target: Math.max(0, (habit.per_week ?? 1) - skipped) };
};

export type DayState = 'done' | 'partial' | 'missed' | 'skipped' | 'off' | 'pending';

// What a cell in the grids shows for a habit on a day.
export const dayState = (habit: Habit, idx: LogIndex, date: string, today: string): DayState => {
  if (!isActiveOn(habit, date) || date > today) return 'off';
  const log = logOn(idx, habit.id, date);
  if (log?.status === 'skipped') return 'skipped';
  if (log?.status === 'slipped') return 'missed';
  if (metOn(habit, log, date, today)) return 'done';
  if (habit.kind === 'count' && (log?.count ?? 0) > 0) return 'partial';
  if (habit.schedule === 'per_week') {
    // Flexible days are never "missed"; today stays open while the week's target isn't met.
    if (date !== today) return 'off';
    const week = weekProgress(habit, idx, date, today);
    return week.done < week.target ? 'pending' : 'off';
  }
  if (!isScheduled(habit, date)) return 'off';
  return date === today ? 'pending' : 'missed';
};

// Shows in today's list on `date`: scheduled, or a per_week habit whose week isn't finished, or anything logged that day.
export const isDueOn = (habit: Habit, idx: LogIndex, date: string, today: string) =>
  isActiveOn(habit, date) && (dayState(habit, idx, date, today) !== 'off' || !!logOn(idx, habit.id, date));

// 0..1 completion on a day (count habits give partial credit).
export const dayValue = (habit: Habit, idx: LogIndex, date: string, today: string) => {
  const state = dayState(habit, idx, date, today);
  if (state === 'done') return 1;
  if (state === 'partial') return Math.min(1, (logOn(idx, habit.id, date)?.count ?? 0) / habit.target);
  return 0;
};

export interface DayProgress {
  due: number; // excludes skipped
  done: number;
  partial: number;
  toGo: number; // not done yet (today)
  missed: number; // missed past days, or an avoid habit slipped today
  skipped: number;
  pct: number; // 0..100, partial credit included; 0 when nothing is due
}

export const dayProgress = (habits: Habit[], idx: LogIndex, date: string, today: string): DayProgress => {
  const p = { due: 0, done: 0, partial: 0, toGo: 0, missed: 0, skipped: 0, pct: 0 };
  let value = 0;
  for (const h of habits) {
    if (!isDueOn(h, idx, date, today)) continue;
    const state = dayState(h, idx, date, today);
    if (state === 'skipped') { p.skipped++; continue; }
    p.due++;
    if (state === 'done') p.done++;
    else if (state === 'partial') p.partial++;
    else if (state === 'missed') p.missed++;
    else p.toGo++;
    value += dayValue(h, idx, date, today);
  }
  p.pct = p.due ? Math.round((value / p.due) * 100) : 0;
  return p;
};

// ---------- streaks & rates ----------

export interface Streaks {
  current: number;
  best: number;
  unit: 'd' | 'wk';
}

// Daily habits count due days met in a row; skipped and off days are passed over, an open
// today doesn't break it. per_week habits count weeks that reached their target.
export const habitStreaks = (habit: Habit, idx: LogIndex, today: string): Streaks => {
  const first = firstDayOf(habit);
  let run = 0;
  let best = 0;
  if (habit.schedule === 'per_week') {
    for (let start = weekStart(first); start <= today; start = addDays(start, 7)) {
      const week = weekProgress(habit, idx, start, today);
      if (week.done >= week.target) run++;
      else if (start !== weekStart(today)) run = 0;
      best = Math.max(best, run);
    }
    return { current: run, best, unit: 'wk' };
  }
  for (let d = first; d <= today; d = addDays(d, 1)) {
    const state = dayState(habit, idx, d, today);
    if (state === 'done') run++;
    else if (state === 'missed' || state === 'partial') run = 0;
    best = Math.max(best, run);
  }
  return { current: run, best, unit: 'd' };
};

// Percent of due days met over the last `days` days; an open today is left out. null when nothing was due.
export const habitRate = (habit: Habit, idx: LogIndex, today: string, days = 30) => {
  if (habit.schedule === 'per_week') {
    let done = 0;
    let target = 0;
    for (let i = 0; i < days; i += 7) {
      const week = weekProgress(habit, idx, addDays(today, -i), today);
      done += Math.min(week.done, week.target);
      target += week.target;
    }
    return target ? Math.round((done / target) * 100) : null;
  }
  let due = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const state = dayState(habit, idx, addDays(today, -i), today);
    if (state === 'off' || state === 'skipped' || state === 'pending') continue;
    due++;
    if (state === 'done') done++;
  }
  return due ? Math.round((done / due) * 100) : null;
};

// ---------- labels ----------

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export const scheduleLabel = (habit: Pick<Habit, 'schedule' | 'weekdays' | 'per_week' | 'interval_days'>) => {
  if (habit.schedule === 'per_week') return `${habit.per_week}× a week`;
  if (habit.schedule === 'interval') return `Every ${habit.interval_days} days`;
  if (habit.weekdays.length === 7) return 'Every day';
  if (habit.weekdays.join() === '1,2,3,4,5') return 'Mon–Fri';
  return MONDAY_FIRST.filter((d) => habit.weekdays.includes(d)).map((d) => DAY_SHORT[d]).join(' · ');
};

export const targetLabel = (habit: Pick<Habit, 'kind' | 'target' | 'unit'>) =>
  habit.kind === 'count' ? `${habit.target.toLocaleString()} ${habit.unit ?? ''}`.trim() : null;

// ---------- reminders ----------

const REMINDER_DAYS = 7;

export interface ReminderNotice {
  id: number;
  at: Date;
  title: string;
  body: string;
}

const atTime = (date: string, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const at = localDay(date);
  at.setHours(hours, minutes);
  return at;
};

// Still to do on `date`: due and not yet met or skipped.
const openOn = (habit: Habit, idx: LogIndex, date: string, today: string) => {
  if (!isActiveOn(habit, date) || habit.archived_at) return false;
  const state = dayState(habit, idx, date, date < today ? today : date);
  return state === 'pending' || state === 'partial';
};

// The next REMINDER_DAYS days of notifications from `now`: one daily summary at `dailyTime`
// (null = off) listing what's open, plus each habit's own reminder times on days it's open.
// Past times and days with nothing open are skipped. Ids: YYYYMMDD for the summary,
// 1e9 + day*1e6 + habitIndex*10 + timeIndex for per-habit ones (unique within one rebuild).
export const reminderSchedule = (habits: Habit[], idx: LogIndex, dailyTime: string | null, now: Date) => {
  const today = fmtLocalDate(now);
  const notices: ReminderNotice[] = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const date = addDays(today, i);
    const open = habits.filter((h) => openOn(h, idx, date, today));
    if (dailyTime && open.length) {
      const at = atTime(date, dailyTime);
      if (at > now) {
        const names = open.map((h) => h.name).join(', ');
        notices.push({ id: Number(date.replace(/-/g, '')), at, title: 'Habits', body: `${open.length} ${i === 0 ? 'left' : 'to do'} today: ${names}` });
      }
    }
    habits.forEach((h, hi) => {
      if (!open.includes(h)) return;
      h.reminder_times.forEach((time, ti) => {
        const at = atTime(date, time);
        if (at <= now) return;
        const target = targetLabel(h);
        notices.push({ id: 1e9 + i * 1e6 + hi * 10 + ti, at, title: h.name, body: h.note || (target ? `Goal: ${target}` : 'Time for this habit') });
      });
    });
  }
  return notices;
};
