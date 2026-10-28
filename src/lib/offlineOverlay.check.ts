// Self-check for offlineOverlay.ts. Run: node src/lib/offlineOverlay.check.ts
import { applyPending, matches, type PendingWrite, type Row } from './offlineOverlay.ts';

let failures = 0;
const eq = (actual: unknown, expected: unknown, label: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures++;
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};

const API = 'https://x.supabase.co/rest/v1/';
const read = (q: string) => new URL(API + q);
const w = (method: string, q: string, body?: unknown): PendingWrite => ({
  url: API + q,
  method,
  headers: {},
  body: body === undefined ? null : JSON.stringify(body),
});
const names = (rows: Row[]) => rows.map((r) => r.name);

eq(matches({ d: '2026-10-24' }, [['d', 'gte.2026-10-01'], ['d', 'lte.2026-10-31']]), true, 'date range');
eq(matches({ n: 5 }, [['n', 'gt.10']]), false, 'numbers compare as numbers');
eq(matches({ id: 'b' }, [['id', 'in.(a,b)']]), true, 'in list');
eq(matches({ a: null }, [['a', 'is.null']]), true, 'is null');
eq(matches({ name: 'Masala Dosa' }, [['name', 'ilike.%dosa%']]), true, 'ilike');
eq(matches({ a: 1 }, [['or', '(a.eq.1)']]), false, 'unknown filter never matches');

const today = 'daily_meals?select=*&user_id=eq.u&logged_date=eq.2026-10-24&order=logged_at.desc';
const server: Row[] = [{ id: '1', user_id: 'u', name: 'Dosa', logged_date: '2026-10-24', logged_at: '2026-10-24T08:00' }];

eq(applyPending(server, read(today), []), server, 'no pending writes: rows untouched');
eq(
  names(applyPending(server, read(today), [w('POST', 'daily_meals', { id: '2', name: 'Dal', user_id: 'u', logged_date: '2026-10-24', logged_at: '2026-10-24T13:00' })])),
  ['Dal', 'Dosa'],
  'insert for today shows first (newest)'
);
eq(
  names(applyPending(server, read(today), [w('POST', 'daily_meals', { id: '3', name: 'Old', user_id: 'u', logged_date: '2026-10-20' })])),
  ['Dosa'],
  'insert for another day stays out'
);
eq(
  names(applyPending(server, read(today), [
    w('POST', 'daily_meals', { id: '2', name: 'Dal', user_id: 'u', logged_date: '2026-10-24' }),
    w('DELETE', 'daily_meals?id=eq.2&user_id=eq.u'),
  ])),
  ['Dosa'],
  'insert then undo'
);
eq(
  applyPending(server, read(today), [w('PATCH', 'daily_meals?id=eq.1&user_id=eq.u', { calories: 300 })])[0].calories,
  300,
  'edit applies'
);
eq(applyPending(server, read('saved_meals?select=*'), [w('DELETE', 'daily_meals?id=eq.1')]), server, 'other tables ignored');

const water = 'water_logs?select=glasses&user_id=eq.u&logged_date=eq.2026-10-24';
const up = (n: number) => w('POST', 'water_logs?on_conflict=user_id,logged_date', { user_id: 'u', logged_date: '2026-10-24', glasses: n });
eq(applyPending([], read(water), [up(1)]).map((r) => r.glasses), [1], 'upsert with no row inserts');
eq(applyPending([{ glasses: 2 }], read(water), [up(3)]).map((r) => r.glasses), [3], 'upsert finds a row read without its key columns');
eq(applyPending([], read(water), [up(1), up(2), up(3)]).map((r) => r.glasses), [3], 'repeated upserts keep one row');

const checks = 'checklist_checks?select=*&user_id=eq.u&checked_date=gte.2026-10-18&checked_date=lte.2026-10-24';
eq(
  applyPending([{ item_id: 'h', checked_date: '2026-10-24', status: 'done' }], read(checks), [
    w('DELETE', 'checklist_checks?item_id=eq.h&checked_date=eq.2026-10-24'),
  ]),
  [],
  'unticking a habit'
);

if (failures) process.exitCode = 1;
else console.log('offlineOverlay: all checks passed');
