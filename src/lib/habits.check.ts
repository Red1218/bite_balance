// Self-check for habits.ts. Run: npm run check:habits
// Runs under IST so the "just after local midnight" cases are real. (Node reads TZ at first
// Date use; habits.ts creates no Dates at import time, so setting it here is early enough.)
process.env.TZ = 'Asia/Kolkata';

import {
  addDays, categoryGroups, categoryNames, dayProgress, dayState, habitRate, habitStreaks, indexLogs, isActiveOn, isDueOn, reminderSchedule,
  scheduleLabel, weekStart, weekdayOf, type Habit, type HabitLog,
} from './habits';

let failures = 0;
const eq = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const habit = (over: Partial<Habit>): Habit => ({
  id: 'x', name: 'x', note: null, weekdays: [0, 1, 2, 3, 4, 5, 6], position: 0,
  created_at: '2026-09-20T06:00:00Z', archived_at: null, kind: 'check', target: 1, unit: null,
  schedule: 'weekdays', per_week: null, interval_days: null, icon: 'check', color: 'violet',
  category: null, time_of_day: 'anytime', reminder_times: [], ...over,
});
const log = (item_id: string, checked_date: string, over: Partial<HabitLog> = {}): HabitLog =>
  ({ item_id, checked_date, status: 'done', count: null, note: null, ...over });
const done = (id: string, dates: string[]) => dates.map((d) => log(id, d));

const TODAY = '2026-09-29'; // Tuesday

// Dates
eq(weekdayOf(TODAY), 2, 'weekdayOf Tuesday');
eq(addDays('2026-09-30', 1), '2026-10-01', 'addDays across month');
eq(weekStart(TODAY), '2026-09-28', 'weekStart is Monday');
eq(weekStart('2026-10-04'), '2026-09-28', 'weekStart of a Sunday');

// Created 2026-09-28T20:00Z = 01:30 IST on 29 Sep -> first active day is the 29th
const lateNight = habit({ created_at: '2026-09-28T20:00:00Z' });
eq(isActiveOn(lateNight, '2026-09-28'), false, 'not active before local creation day');
eq(isActiveOn(lateNight, '2026-09-29'), true, 'active on local creation day');

// Labels
eq(scheduleLabel(habit({})), 'Every day', 'label every day');
eq(scheduleLabel(habit({ weekdays: [1, 2, 3, 4, 5] })), 'Mon–Fri', 'label weekdays');
eq(scheduleLabel(habit({ weekdays: [5, 1, 3] })), 'Mon · Wed · Fri', 'label MWF');
eq(scheduleLabel(habit({ schedule: 'per_week', per_week: 3 })), '3× a week', 'label per week');
eq(scheduleLabel(habit({ schedule: 'interval', interval_days: 2 })), 'Every 2 days', 'label interval');

// Daily check streaks: open today doesn't break; a skip is passed over; a miss resets.
const d = habit({ id: 'd' });
eq(habitStreaks(d, indexLogs(done('d', ['2026-09-27', '2026-09-28'])), TODAY).current, 2, 'open today keeps streak');
eq(habitStreaks(d, indexLogs(done('d', ['2026-09-26', '2026-09-27'])), TODAY).current, 0, 'missed yesterday resets');
eq(
  habitStreaks(d, indexLogs([...done('d', ['2026-09-26', '2026-09-28', '2026-09-29']), log('d', '2026-09-27', { status: 'skipped' })]), TODAY).current,
  3,
  'skipped day keeps streak'
);
eq(
  habitStreaks(d, indexLogs(done('d', ['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-28'])), TODAY),
  { current: 1, best: 4, unit: 'd' },
  'best streak survives a reset'
);

// Count habit: below target is partial and breaks the streak on past days; today's partial is "partial".
const water = habit({ id: 'w', kind: 'count', target: 8 });
const wIdx = indexLogs([log('w', '2026-09-27', { count: 8 }), log('w', '2026-09-28', { count: 5 }), log('w', TODAY, { count: 3 })]);
eq(dayState(water, wIdx, '2026-09-27', TODAY), 'done', 'count at target is done');
eq(dayState(water, wIdx, '2026-09-28', TODAY), 'partial', 'count below target is partial');
eq(habitStreaks(water, wIdx, TODAY).current, 0, 'past partial breaks count streak');

// Avoid habit: unmarked past days are held, slipped is missed, unmarked today is pending.
const sugar = habit({ id: 's', kind: 'avoid' });
const sIdx = indexLogs([log('s', '2026-09-25', { status: 'slipped' })]);
eq(dayState(sugar, sIdx, '2026-09-26', TODAY), 'done', 'unmarked past avoid day counts as held');
eq(dayState(sugar, sIdx, '2026-09-25', TODAY), 'missed', 'slipped avoid day is missed');
eq(dayState(sugar, sIdx, TODAY, TODAY), 'pending', 'unmarked avoid today is pending');
eq(dayState(sugar, indexLogs([log('s', TODAY, { status: 'slipped' })]), TODAY, TODAY), 'missed', 'slipped avoid today is missed, not open');
eq(habitStreaks(sugar, sIdx, TODAY).current, 3, 'avoid streak counts held days after a slip (26–28)');

// Every 2 days from 20 Sep: due 20, 22, … 28; 29 is off.
const stretch = habit({ id: 'i', schedule: 'interval', interval_days: 2 });
eq(dayState(stretch, indexLogs([]), '2026-09-28', TODAY), 'missed', 'interval due day missed');
eq(dayState(stretch, indexLogs([]), TODAY, TODAY), 'off', 'interval off day');
eq(habitStreaks(stretch, indexLogs(done('i', ['2026-09-24', '2026-09-26', '2026-09-28'])), TODAY).current, 3, 'interval streak skips off days');

// 3× a week: days are never missed; streak counts weeks; today is open until the week's target is met.
const read = habit({ id: 'r', schedule: 'per_week', per_week: 3, created_at: '2026-09-14T06:00:00Z' });
const rIdx = indexLogs(done('r', ['2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21', '2026-09-23', '2026-09-25', '2026-09-28']));
eq(dayState(read, rIdx, '2026-09-27', TODAY), 'off', 'per-week rest day is off, not missed');
eq(dayState(read, rIdx, TODAY, TODAY), 'pending', 'per-week today open while week unmet');
eq(habitStreaks(read, rIdx, TODAY), { current: 2, best: 2, unit: 'wk' }, 'per-week streak in weeks, current week open');
const rDone = indexLogs([...rIdx.values(), ...done('r', [TODAY, '2026-09-29'])].concat(done('r', ['2026-09-30'])));
eq(dayState(read, rDone, '2026-09-30', '2026-09-30'), 'done', 'per-week extra day logged shows done');

// Progress: skipped excluded from due, partial credit counted, off-schedule left out.
const mon = habit({ id: 'm', weekdays: [1] });
const pIdx = indexLogs([log('d', TODAY), log('w', TODAY, { count: 4 }), log('s', TODAY, { status: 'skipped' })]);
eq(isDueOn(mon, pIdx, TODAY, TODAY), false, 'Monday-only habit not due Tuesday');
eq(
  dayProgress([d, water, sugar, mon], pIdx, TODAY, TODAY),
  { due: 2, done: 1, partial: 1, toGo: 0, missed: 0, skipped: 1, pct: 75 },
  'day progress with partial and skip'
);

// Rate over 30 days, today left out while open.
eq(habitRate(habit({ id: 'n', created_at: '2026-09-29T06:00:00Z' }), indexLogs([]), TODAY), null, 'rate null when nothing due');
eq(habitRate(d, indexLogs(done('d', ['2026-09-20', '2026-09-21', '2026-09-22'])), TODAY), 33, 'rate 3/9 excludes open today');

// Reminders. Now = Tue 29 Sep 18:00 IST. A daily (done today), B Mondays with its own 09:00 reminder.
const NOW = new Date(2026, 8, 29, 18, 0);
const rA = habit({ id: 'a', name: 'A' });
const rB = habit({ id: 'b', name: 'B', weekdays: [1], reminder_times: ['09:00'] });
const brief = (list: { id: number; at: Date; title: string; body: string }[]) =>
  list.map((n) => `${n.id} ${n.at.getDate()} ${n.at.getHours()}:${n.at.getMinutes()} ${n.title}: ${n.body}`);
eq(
  brief(reminderSchedule([rA, rB], indexLogs(done('a', [TODAY])), '20:00', NOW)),
  [
    '20260930 30 20:0 Habits: 1 to do today: A',
    '20261001 1 20:0 Habits: 1 to do today: A',
    '20261002 2 20:0 Habits: 1 to do today: A',
    '20261003 3 20:0 Habits: 1 to do today: A',
    '20261004 4 20:0 Habits: 1 to do today: A',
    '20261005 5 20:0 Habits: 2 to do today: A, B',
    '1006000010 5 9:0 B: Time for this habit',
  ],
  'reminders: summary skips a finished today, per-habit only on its days'
);
eq(reminderSchedule([rA], indexLogs([]), null, NOW), [], 'daily summary off and no habit times -> nothing');

const cat = (category: string | null, name: string) => ({ category, name });
const mixed = [cat(null, 'a'), cat('Fitness', 'b'), cat('Food', 'c'), cat('Fitness', 'd')];
eq(categoryNames(mixed), ['Fitness', 'Food'], 'names in first-seen order, no duplicates or blanks');
eq(categoryGroups(mixed).map((g) => [g.name, g.habits.map((h) => h.name)]), [['Fitness', ['b', 'd']], ['Food', ['c']], [null, ['a']]], 'uncategorised habits come last');
eq(categoryGroups([cat('Fitness', 'b')]).length, 1, 'no empty Other group');

if (failures) process.exitCode = 1;
else console.log('habits: all checks passed');
