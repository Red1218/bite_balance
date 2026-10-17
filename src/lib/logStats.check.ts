// Self-check for logStats.ts. Run: node src/lib/logStats.check.ts
import { bestStreak, weekLogged } from './logStats.ts';

let failures = 0;
const eq = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

eq(bestStreak([]), 0, 'no logs');
eq(bestStreak(['2026-10-10']), 1, 'one day');
eq(bestStreak(['2026-10-12', '2026-10-10', '2026-10-11', '2026-10-11']), 3, 'unsorted with duplicates');
eq(bestStreak(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']), 4, 'longest of two runs');
eq(bestStreak(['2026-10-31', '2026-11-01', '2026-11-02']), 3, 'across a month end');

// 2026-10-18 is a Sunday, so its week runs Mon 12 .. Sun 18.
eq(weekLogged(new Set(['2026-10-12', '2026-10-14', '2026-10-18', '2026-10-19']), '2026-10-18'),
  [true, false, true, false, false, false, true], 'Monday-first week, Sunday today');
// 2026-10-12 is a Monday: the week starts that day.
eq(weekLogged(new Set(['2026-10-11', '2026-10-12']), '2026-10-12'),
  [true, false, false, false, false, false, false], 'Monday today ignores the Sunday before');

if (failures) process.exitCode = 1;
else console.log('logStats: all checks passed');
