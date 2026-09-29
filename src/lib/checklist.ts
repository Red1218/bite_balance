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

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

export const scheduleLabel = (weekdays: number[]) =>
  weekdays.length === 7
    ? 'Every day'
    : MONDAY_FIRST.filter((d) => weekdays.includes(d)).map((d) => DAY_SHORT[d]).join(' · ');
