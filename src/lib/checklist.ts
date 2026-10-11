// Pure checklist rules -- no React, no Supabase. `date` is always a local YYYY-MM-DD day.
import { fmtLocalDate } from './utils';

export interface ChecklistItem {
  id: string;
  name: string;
  note: string | null;
  weekdays: number[]; // 0 = Sun … 6 = Sat
  position: number;
  created_at: string;
  archived_at: string | null;
}

export interface ChecklistCheck {
  item_id: string;
  checked_date: string;
}

export interface ChecklistItemValues {
  name: string;
  note: string | null;
  weekdays: number[];
}

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const localDay = (date: string) => new Date(`${date}T00:00:00`);

export const weekdayOf = (date: string) => localDay(date).getDay();

export const addDays = (date: string, n: number) => {
  const d = localDay(date);
  d.setDate(d.getDate() + n);
  return fmtLocalDate(d);
};

// Exists on `date`: created on/before it, not yet archived.
export const isActiveOn = (item: ChecklistItem, date: string) =>
  date >= fmtLocalDate(new Date(item.created_at)) &&
  (!item.archived_at || date < fmtLocalDate(new Date(item.archived_at)));

export const isDue = (item: ChecklistItem, date: string) =>
  item.weekdays.includes(weekdayOf(date)) && isActiveOn(item, date);

export const isChecked = (checks: ChecklistCheck[], itemId: string, date: string) =>
  checks.some((c) => c.item_id === itemId && c.checked_date === date);

export const dayProgress = (items: ChecklistItem[], checks: ChecklistCheck[], date: string) => {
  const due = items.filter((i) => isDue(i, date));
  return { done: due.filter((i) => isChecked(checks, i.id, date)).length, due: due.length };
};

// Due days ticked in a row, counting back from `today`. Off-schedule days are skipped; an
// unticked today doesn't break it (the day isn't over). Days before the item existed end it.
export const itemStreak = (item: ChecklistItem, checks: ChecklistCheck[], today: string, maxDays = 365) => {
  const firstDay = fmtLocalDate(new Date(item.created_at));
  let streak = 0;
  for (let i = 0; i < maxDays; i++) {
    const date = addDays(today, -i);
    if (date < firstDay) break;
    if (!isDue(item, date)) continue;
    if (isChecked(checks, item.id, date)) streak++;
    else if (i > 0) break;
  }
  return streak;
};

// Percent of due days ticked over the last `days` days; today counts only once ticked.
// null when nothing has been due yet.
export const itemRate = (item: ChecklistItem, checks: ChecklistCheck[], today: string, days = 30) => {
  let due = 0;
  let done = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(today, -i);
    if (!isDue(item, date)) continue;
    const checked = isChecked(checks, item.id, date);
    if (i === 0 && !checked) continue;
    due++;
    if (checked) done++;
  }
  return due ? Math.round((done / due) * 100) : null;
};

const DAY_SHORT =['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export const scheduleLabel = (weekdays: number[]) =>
  weekdays.length === 7
    ? 'Every day'
    : MONDAY_FIRST.filter((d) => weekdays.includes(d)).map((d) => DAY_SHORT[d]).join(' · ');
