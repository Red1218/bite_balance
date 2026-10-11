// Self-check for checklist.ts. Run: npm run check:checklist
// Runs under IST so the "just after local midnight" cases are real. (Node reads TZ at first
// Date use; checklist.ts creates no Dates at import time, so setting it here is early enough.)
process.env.TZ = 'Asia/Kolkata';

import { addDays, dayProgress, isActiveOn, isDue, itemRate, itemStreak, reminderSchedule, scheduleLabel, weekdayOf, type ChecklistItem } from './checklist';

let failures = 0;
const eq = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const item = (over: Partial<ChecklistItem>): ChecklistItem => ({
  id: 'x', name: 'x', note: null, weekdays: [0, 1, 2, 3, 4, 5, 6], position: 0,
  created_at: '2026-09-01T06:00:00Z', archived_at: null, ...over,
});

// Dates
eq(weekdayOf('2026-09-29'), 2, 'weekdayOf Tuesday');
eq(addDays('2026-09-30', 1), '2026-10-01', 'addDays across month');
eq(addDays('2026-03-01', -1), '2026-02-28', 'addDays back across Feb');

// Created 2026-09-28T20:00Z = 01:30 IST on 29 Sep -> first active day is the 29th, not the 28th
const lateNight = item({ created_at: '2026-09-28T20:00:00Z' });
eq(isActiveOn(lateNight, '2026-09-28'), false, 'not active before local creation day');
eq(isActiveOn(lateNight, '2026-09-29'), true, 'active on local creation day');

// Mon/Wed/Fri schedule
const mwf = item({ weekdays: [1, 3, 5] });
eq(isDue(mwf, '2026-09-28'), true, 'MWF due Monday');
eq(isDue(mwf, '2026-09-29'), false, 'MWF not due Tuesday');

// Archived 2026-09-25T06:00Z = 11:30 IST on the 25th -> last due day is the 24th
const archived = item({ archived_at: '2026-09-25T06:00:00Z' });
eq(isDue(archived, '2026-09-24'), true, 'due before archive day');
eq(isDue(archived, '2026-09-25'), false, 'not due from archive day');

// Progress: only due items count
const a = item({ id: 'a' });
const b = item({ id: 'b', weekdays: [1] }); // Monday only
const checks = [{ item_id: 'a', checked_date: '2026-09-29' }];
eq(dayProgress([a, b], checks, '2026-09-29'), { done: 1, due: 1 }, 'Tuesday: b not due');
eq(dayProgress([a, b], checks, '2026-09-28'), { done: 0, due: 2 }, 'Monday: both due, none done');

// Labels (Monday-first)
eq(scheduleLabel([0, 1, 2, 3, 4, 5, 6]), 'Every day', 'label every day');
eq(scheduleLabel([5, 1, 3]), 'Mon · Wed · Fri', 'label MWF sorted');
eq(scheduleLabel([0]), 'Sun', 'label Sunday only');

// Streak + rate. "Today" is Tue 2026-09-29; `ticks` builds checks for an item.
const ticks = (id: string, dates: string[]) => dates.map((checked_date) => ({ item_id: id, checked_date }));
const TODAY = '2026-09-29';
const daily = item({ id: 'd', created_at: '2026-09-20T06:00:00Z' }); // first day: 20 Sep

eq(itemStreak(daily, ticks('d', ['2026-09-27', '2026-09-28', '2026-09-29']), TODAY), 3, 'streak counts today when ticked');
eq(itemStreak(daily, ticks('d', ['2026-09-27', '2026-09-28']), TODAY), 2, 'unticked today does not break streak');
eq(itemStreak(daily, ticks('d', ['2026-09-26', '2026-09-27']), TODAY), 0, 'missed yesterday breaks streak');
eq(
  itemStreak(daily, ticks('d', ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28', '2026-09-29']), TODAY),
  10,
  'streak stops at creation day, not a miss before it'
);
// Mon/Wed/Fri: due Mon 28, Fri 25, Wed 23 -- off days (Tue 29, Sat, Sun) are skipped
const mwfItem = item({ id: 'm', weekdays: [1, 3, 5], created_at: '2026-09-20T06:00:00Z' });
eq(itemStreak(mwfItem, ticks('m', ['2026-09-23', '2026-09-25', '2026-09-28']), TODAY), 3, 'weekday streak skips off days');
eq(itemStreak(mwfItem, ticks('m', ['2026-09-23', '2026-09-28']), TODAY), 1, 'weekday streak breaks on missed Friday');

// Rate over the last 30 days: daily item exists 20–29 Sep = 10 due days (today counts only once ticked)
eq(itemRate(daily, ticks('d', ['2026-09-20', '2026-09-21', '2026-09-22']), TODAY), 33, 'rate 3/9 excludes unticked today');
eq(itemRate(daily, ticks('d', ['2026-09-20', '2026-09-29']), TODAY), 20, 'rate 2/10 includes ticked today');
eq(itemRate(item({ id: 'n', created_at: '2026-09-29T06:00:00Z' }), [], TODAY), null, 'rate null when nothing due yet');

// Reminders. "Now" is Tue 29 Sep 18:00 IST. A daily, B Mondays, C archived 1 Oct (last due 30 Sep).
const NOW = new Date(2026, 8, 29, 18, 0);
const rA = item({ id: 'a', name: 'A' });
const rB = item({ id: 'b', name: 'B', weekdays: [1] });
const rC = item({ id: 'c', name: 'C', archived_at: '2026-10-01T06:00:00Z' });
const brief = (list: { id: number; at: Date; body: string }[]) => list.map((n) => `${n.id} ${n.at.getHours()}:${n.at.getMinutes()} ${n.body}`);

eq(
  brief(reminderSchedule([rA, rB, rC], ticks('a', ['2026-09-29']), '20:00', NOW)),
  [
    '20260929 20:0 1 left today: C',
    '20260930 20:0 2 to do today: A, C',
    '20261001 20:0 1 to do today: A',
    '20261002 20:0 1 to do today: A',
    '20261003 20:0 1 to do today: A',
    '20261004 20:0 1 to do today: A',
    '20261005 20:0 2 to do today: A, B',
  ],
  'reminders: 7 days, unticked only today, archived and off-schedule items left out'
);
eq(reminderSchedule([rA], [], '17:30', NOW)[0].id, 20260930, 'reminders: time already passed today -> starts tomorrow');
eq(reminderSchedule([rA], ticks('a', ['2026-09-29']), '20:00', NOW)[0].id, 20260930, 'reminders: all ticked today -> none today');
eq(reminderSchedule([rB], [], '20:00', NOW).map((n) => n.id), [20261005], 'reminders: only days with something due');
eq(reminderSchedule([], [], '20:00', NOW), [], 'reminders: no items -> nothing');

if (failures) process.exitCode = 1;
else console.log('checklist: all checks passed');
