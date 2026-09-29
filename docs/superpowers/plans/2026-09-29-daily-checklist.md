# Daily Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily checklist of recurring tasks/supplements — tick them on the Today screen, manage them and review/fix history (week grid + month calendar) on a new Checklist page.

**Architecture:** Two Supabase tables (`checklist_items`, `checklist_checks`, RLS per user). A pure-logic module (`src/lib/checklist.ts`) decides what is due/done on a local date; one hook (`useChecklist`) loads a date range and does optimistic ticks; UI is a Today card, a shared row component, an item sheet, and the page.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind (semantic HSL tokens), Supabase JS, vaul `Drawer`, lucide-react icons, Capacitor Android.

**Spec:** `docs/superpowers/specs/2026-09-29-daily-checklist-design.md`

## Global Constraints

- Work on branch `daily-checklist` (already exists, cut from `main`).
- **Do not commit or push.** The user commits only when they say "commit this". Each task ends with a report, not a commit.
- Colours: semantic Tailwind tokens only (`bg-card`, `text-muted-foreground`, `bg-chart-fiber`, `bg-primary`…). No hex/HSL literals — the app has light and dark themes.
- Dates: always local calendar days via `fmtLocalDate` (`src/lib/utils.ts`) or `addDays` (Task 1). Never `toISOString().split('T')[0]`.
- Supabase project ref: `ppbckzgqevfpkhymwuxs`. Test user email: `venkatphani2@gmail.com`.
- Weekday numbers: `0` = Sunday … `6` = Saturday (JS `getDay()`).
- UI copy (verbatim): card label `Checklist`; `All done`; `Track daily supplements and habits`; `Add items`; `Nothing scheduled today`; `Nothing scheduled on this day`; `Every day`; schedule joiner ` · `.
- Phone test device: `adb` id `R9ZYA00X9HW`, package `com.bite_balance.app`. Build + install:
  ```bash
  npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug -q) && adb install -r android/app/build/outputs/apk/debug/app-debug.apk && adb shell am force-stop com.bite_balance.app && adb shell am start -n com.bite_balance.app/.MainActivity
  ```
- Type/lint baseline: `npx tsc --noEmit -p tsconfig.app.json` currently reports **17** errors, all in untouched files. Your changes must not add any; `npx eslint <your files>` must report no errors.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/checklist.ts` (create) | Pure logic + types: due/active rules, day progress, schedule label, date math. No React, no Supabase. |
| `src/lib/checklist.check.ts` (create) | Assert-based self-check for `checklist.ts`, run under IST. |
| `package.json` (modify) | `check:checklist` script. |
| `supabase/migrations/20260929000000_create_checklist.sql` (create) | Tables, constraints, RLS, indexes. |
| `src/integrations/supabase/types.ts` (modify) | Row/Insert/Update types for the two tables. |
| `src/hooks/useChecklist.ts` (create) | `useLocalToday()` and `useChecklist(from, to)` — load, toggle, save, archive. |
| `src/components/ChecklistRow.tsx` (create) | One tickable row (used by the card and the page's day panel). |
| `src/components/ChecklistCard.tsx` (create) | Today-screen card. |
| `src/pages/Dashboard.tsx` (modify) | Render the card below Water + Steps. |
| `src/components/ChecklistItemSheet.tsx` (create) | Add/edit/archive bottom sheet. |
| `src/pages/Checklist.tsx` (create) | Page: week grid, month calendar, day panel, items list. |
| `src/App.tsx`, `src/components/AppDrawer.tsx` (modify) | Route `/checklist`, side-menu entry. |

---

### Task 1: Checklist logic + self-check

**Files:**
- Create: `src/lib/checklist.ts`
- Create: `src/lib/checklist.check.ts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Produces (used by every later task):
  ```ts
  export interface ChecklistItem { id: string; name: string; note: string | null; weekdays: number[]; position: number; created_at: string; archived_at: string | null }
  export interface ChecklistCheck { item_id: string; checked_date: string }
  export interface ChecklistItemValues { name: string; note: string | null; weekdays: number[] }
  export const ALL_WEEKDAYS: number[]            // [0,1,2,3,4,5,6]
  export const weekdayOf: (date: string) => number
  export const addDays: (date: string, n: number) => string
  export const isActiveOn: (item: ChecklistItem, date: string) => boolean
  export const isDue: (item: ChecklistItem, date: string) => boolean
  export const isChecked: (checks: ChecklistCheck[], itemId: string, date: string) => boolean
  export const dayProgress: (items: ChecklistItem[], checks: ChecklistCheck[], date: string) => { done: number; due: number }
  export const scheduleLabel: (weekdays: number[]) => string
  ```
  `date` is always a local `YYYY-MM-DD` string.

- [ ] **Step 1: Write the self-check (the failing test)**

Create `src/lib/checklist.check.ts`:

```ts
// Self-check for checklist.ts. Run: npm run check:checklist
// Runs under IST so the "just after local midnight" cases are real. (Node reads TZ at first
// Date use; checklist.ts creates no Dates at import time, so setting it here is early enough.)
process.env.TZ = 'Asia/Kolkata';

import { addDays, dayProgress, isActiveOn, isDue, scheduleLabel, weekdayOf, type ChecklistItem } from './checklist';

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

if (failures) process.exitCode = 1;
else console.log('checklist: all checks passed');
```

- [ ] **Step 2: Add the script**

In `package.json` `"scripts"`, add:

```json
"check:checklist": "esbuild src/lib/checklist.check.ts --bundle --platform=node --log-level=warning --outfile=node_modules/.cache/checklist-check.cjs && node node_modules/.cache/checklist-check.cjs"
```

(`esbuild` is already installed as a Vite dependency.)

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run check:checklist`
Expected: FAIL — esbuild error `Could not resolve "./checklist"`.

- [ ] **Step 4: Implement `src/lib/checklist.ts`**

```ts
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
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npm run check:checklist`
Expected: `checklist: all checks passed`

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → Expected: `17`
Run: `npx eslint src/lib/checklist.ts src/lib/checklist.check.ts` → Expected: no output.

- [ ] **Step 7: Report** (no commit) — list files created and the check output.

---

### Task 2: Database tables, RLS and types

**Files:**
- Create: `supabase/migrations/20260929000000_create_checklist.sql`
- Modify: `src/integrations/supabase/types.ts` (inside `public.Tables`, before `chat_messages`)

**Interfaces:**
- Produces: tables `public.checklist_items`, `public.checklist_checks` with the columns in the migration; generated types `Tables<'checklist_items'>` whose `Row` is assignable to `ChecklistItem`.

- [ ] **Step 1: Write the migration**

```sql
-- Daily checklist: recurring items and one row per tick (row exists = done that local day).
create table public.checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  note        text,
  weekdays    smallint[] not null default '{0,1,2,3,4,5,6}'
              check (cardinality(weekdays) > 0 and weekdays <@ '{0,1,2,3,4,5,6}'::smallint[]),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.checklist_items enable row level security;

create policy "Users can read own checklist items" on public.checklist_items
  for select using (auth.uid() = user_id);
create policy "Users can insert own checklist items" on public.checklist_items
  for insert with check (auth.uid() = user_id);
create policy "Users can update own checklist items" on public.checklist_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete own checklist items" on public.checklist_items
  for delete using (auth.uid() = user_id);

create index checklist_items_user_idx on public.checklist_items (user_id, position);

create table public.checklist_checks (
  item_id      uuid not null references public.checklist_items(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  checked_date date not null,
  created_at   timestamptz not null default now(),
  primary key (item_id, checked_date)
);

alter table public.checklist_checks enable row level security;

create policy "Users can read own checklist checks" on public.checklist_checks
  for select using (auth.uid() = user_id);
-- The item must also be yours, so nobody can tick someone else's item.
create policy "Users can insert own checklist checks" on public.checklist_checks
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.checklist_items i where i.id = item_id and i.user_id = auth.uid())
  );
create policy "Users can delete own checklist checks" on public.checklist_checks
  for delete using (auth.uid() = user_id);

create index checklist_checks_user_date_idx on public.checklist_checks (user_id, checked_date);
```

- [ ] **Step 2: Apply it**

Use the Supabase MCP `apply_migration` tool: project `ppbckzgqevfpkhymwuxs`, name `create_checklist`, query = the file contents.
Expected: success.

- [ ] **Step 3: Verify RLS isolates users** (runs in a rolled-back block; nothing persists)

Run via MCP `execute_sql`:

```sql
do $$
declare
  uid uuid := (select id from auth.users where email = 'venkatphani2@gmail.com');
  stranger int; owner int;
begin
  insert into public.checklist_items (id, user_id, name)
    values ('11111111-1111-1111-1111-111111111111', uid, 'rls test');
  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text, true);
  select count(*) into stranger from public.checklist_items where id = '11111111-1111-1111-1111-111111111111';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  select count(*) into owner from public.checklist_items where id = '11111111-1111-1111-1111-111111111111';
  raise exception 'RESULT stranger=% owner=%', stranger, owner;
end $$;
```

Expected: error message `RESULT stranger=0 owner=1`.

- [ ] **Step 4: Verify a duplicate tick is rejected**

```sql
do $$
declare uid uuid := (select id from auth.users where email = 'venkatphani2@gmail.com');
begin
  insert into public.checklist_items (id, user_id, name)
    values ('22222222-2222-2222-2222-222222222222', uid, 'dup test');
  insert into public.checklist_checks (item_id, user_id, checked_date)
    values ('22222222-2222-2222-2222-222222222222', uid, '2026-09-29');
  begin
    insert into public.checklist_checks (item_id, user_id, checked_date)
      values ('22222222-2222-2222-2222-222222222222', uid, '2026-09-29');
    raise exception 'RESULT duplicate accepted';
  exception when unique_violation then
    raise exception 'RESULT duplicate rejected';
  end;
end $$;
```

Expected: error message `RESULT duplicate rejected`.
Then confirm nothing leaked: `select count(*) from public.checklist_items;` → Expected `0`.

- [ ] **Step 5: Add the generated types**

Run MCP `generate_typescript_types` for the project and copy **only** the `checklist_checks` and `checklist_items` entries into `src/integrations/supabase/types.ts`, directly after the line `    Tables: {` (tables are alphabetical, so they go before `chat_messages`). Do not replace the rest of the file. Expected shape:

```ts
      checklist_checks: {
        Row: { checked_date: string; created_at: string; item_id: string; user_id: string }
        Insert: { checked_date: string; created_at?: string; item_id: string; user_id: string }
        Update: { checked_date?: string; created_at?: string; item_id?: string; user_id?: string }
        Relationships: [
          { foreignKeyName: "checklist_checks_item_id_fkey"; columns: ["item_id"]; isOneToOne: false; referencedRelation: "checklist_items"; referencedColumns: ["id"] },
        ]
      }
      checklist_items: {
        Row: { archived_at: string | null; created_at: string; id: string; name: string; note: string | null; position: number; user_id: string; weekdays: number[] }
        Insert: { archived_at?: string | null; created_at?: string; id?: string; name: string; note?: string | null; position?: number; user_id: string; weekdays?: number[] }
        Update: { archived_at?: string | null; created_at?: string; id?: string; name?: string; note?: string | null; position?: number; user_id?: string; weekdays?: number[] }
        Relationships: []
      }
```

(Keep the generator's own formatting — multi-line objects — if it differs; the field names and types above are what matter.)

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → Expected: `17`

- [ ] **Step 7: Report** (no commit) — include the two `RESULT` messages.

---

### Task 3: Hook, row and the Today card

**Files:**
- Create: `src/hooks/useChecklist.ts`
- Create: `src/components/ChecklistRow.tsx`
- Create: `src/components/ChecklistCard.tsx`
- Modify: `src/pages/Dashboard.tsx` (after the `{/* Water + Steps */}` grid, before `{/* Today's Meals */}`)

**Interfaces:**
- Consumes (Task 1): `ChecklistItem`, `ChecklistCheck`, `ChecklistItemValues`, `isChecked`, `isDue`.
- Produces:
  ```ts
  export const useLocalToday: () => string
  export const useChecklist: (from: string, to: string) => {
    items: ChecklistItem[]            // active AND archived, ordered by position, created_at
    checks: ChecklistCheck[]          // checked_date within [from, to]
    loading: boolean
    error: string | null
    toggle: (itemId: string, date: string) => Promise<void>
    saveItem: (values: ChecklistItemValues, id?: string) => Promise<boolean>   // false = failed (toast shown)
    archiveItem: (id: string) => Promise<boolean>
  }
  // default export
  const ChecklistRow: (props: { item: ChecklistItem; checked: boolean; onToggle: () => void }) => JSX.Element
  ```

- [ ] **Step 1: Write `src/hooks/useChecklist.ts`**

```ts
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fmtLocalDate } from '@/lib/utils';
import { isChecked, type ChecklistCheck, type ChecklistItem, type ChecklistItemValues } from '@/lib/checklist';

// Today's local date, refreshed when the app comes back to the foreground --
// so a card left open overnight moves on to the new day's list.
export const useLocalToday = () => {
  const [today, setToday] = useState(() => fmtLocalDate(new Date()));
  useEffect(() => {
    const sync = () => setToday(fmtLocalDate(new Date()));
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  return today;
};

export const useChecklist = (from: string, to: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [checks, setChecks] = useState<ChecklistCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [itemsRes, checksRes] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('user_id', user.id).order('position').order('created_at'),
      supabase
        .from('checklist_checks')
        .select('item_id, checked_date')
        .eq('user_id', user.id)
        .gte('checked_date', from)
        .lte('checked_date', to),
    ]);
    if (itemsRes.error || checksRes.error) {
      console.error('Error loading checklist:', itemsRes.error ?? checksRes.error);
      setError('Could not load your checklist.');
    } else {
      setItems(itemsRes.data);
      setChecks(checksRes.data);
    }
    setLoading(false);
  }, [user, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const failed = (description: string) => toast({ title: 'Error', description, variant: 'destructive' });

  // Optimistic: flip locally first, flip back if the write fails.
  const toggle = async (itemId: string, date: string) => {
    if (!user) return;
    const wasChecked = isChecked(checks, itemId, date);
    const without = (list: ChecklistCheck[]) => list.filter((c) => !(c.item_id === itemId && c.checked_date === date));
    const show = (checked: boolean) =>
      setChecks((prev) => (checked ? [...without(prev), { item_id: itemId, checked_date: date }] : without(prev)));

    show(!wasChecked);
    const { error: writeError } = wasChecked
      ? await supabase.from('checklist_checks').delete().eq('item_id', itemId).eq('checked_date', date)
      : await supabase
          .from('checklist_checks')
          .upsert({ item_id: itemId, user_id: user.id, checked_date: date }, { onConflict: 'item_id,checked_date', ignoreDuplicates: true });
    if (writeError) {
      console.error('Error saving tick:', writeError);
      show(wasChecked);
      failed('Could not save that tick. Please try again.');
    }
  };

  const saveItem = async (values: ChecklistItemValues, id?: string) => {
    if (!user) return false;
    const nextPosition = items.reduce((max, i) => Math.max(max, i.position), -1) + 1;
    const { data, error: writeError } = id
      ? await supabase.from('checklist_items').update(values).eq('id', id).select().single()
      : await supabase.from('checklist_items').insert({ ...values, user_id: user.id, position: nextPosition }).select().single();
    if (writeError || !data) {
      console.error('Error saving checklist item:', writeError);
      failed('Could not save the item. Please try again.');
      return false;
    }
    setItems((prev) => (id ? prev.map((i) => (i.id === id ? data : i)) : [...prev, data]));
    return true;
  };

  const archiveItem = async (id: string) => {
    const { data, error: writeError } = await supabase
      .from('checklist_items')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (writeError || !data) {
      console.error('Error archiving checklist item:', writeError);
      failed('Could not archive the item. Please try again.');
      return false;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
    return true;
  };

  return { items, checks, loading, error, toggle, saveItem, archiveItem };
};
```

(`archived_at: new Date().toISOString()` is a timestamp, not a date — that is correct; `isActiveOn` converts it to the local day.)

- [ ] **Step 2: Write `src/components/ChecklistRow.tsx`**

```tsx
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@/lib/checklist';

// One tickable item. Ticked rows stay in place (no reordering) so the list never jumps under a thumb.
const ChecklistRow = ({ item, checked, onToggle }: { item: ChecklistItem; checked: boolean; onToggle: () => void }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={onToggle}
    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-muted/60"
  >
    <span
      className={cn(
        'flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 transition-colors',
        checked ? 'border-chart-fiber bg-chart-fiber text-background' : 'border-muted-foreground/50'
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
    <span className="min-w-0 flex-1">
      <span className={cn('block break-words text-sm', checked ? 'text-muted-foreground line-through' : 'text-foreground')}>
        {item.name}
      </span>
      {item.note && <span className="block break-words text-xs text-muted-foreground">{item.note}</span>}
    </span>
  </button>
);

export default ChecklistRow;
```

- [ ] **Step 3: Write `src/components/ChecklistCard.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isChecked, isDue } from '@/lib/checklist';
import { useChecklist, useLocalToday } from '@/hooks/useChecklist';
import ChecklistRow from '@/components/ChecklistRow';

const ChecklistCard = () => {
  const today = useLocalToday();
  const { items, checks, loading, error, toggle } = useChecklist(today, today);
  const due = items.filter((i) => isDue(i, today));
  const done = due.filter((i) => isChecked(checks, i.id, today)).length;
  const hasItems = items.some((i) => !i.archived_at);
  const allDone = due.length > 0 && done === due.length;

  return (
    <div className="elevation-card flex flex-col gap-2.5 p-[14px]">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Checklist
        </span>
        <div className="flex items-center gap-3">
          {due.length > 0 && (
            <span className={cn('font-mono text-xs font-semibold tabular-nums', allDone ? 'text-chart-fiber' : 'text-muted-foreground')}>
              {allDone ? 'All done' : `${done} / ${due.length}`}
            </span>
          )}
          <Link to="/checklist" className="flex items-center text-xs font-medium text-primary">
            All
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex h-12 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !hasItems ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Track daily supplements and habits</p>
          <Link to="/checklist" className="flex-none rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Add items
          </Link>
        </div>
      ) : due.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled today</p>
      ) : (
        <div className="-mx-1 flex flex-col">
          {due.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              checked={isChecked(checks, item.id, today)}
              onToggle={() => toggle(item.id, today)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChecklistCard;
```

- [ ] **Step 4: Render it on the Dashboard**

In `src/pages/Dashboard.tsx` add `import ChecklistCard from '@/components/ChecklistCard';` next to the `WaterTracker` import, and insert after the Water + Steps grid:

```tsx
      {/* Water + Steps */}
      <div className="grid grid-cols-2 gap-[11px]">
        <WaterTracker />
        <StepsSection />
      </div>

      {/* Daily checklist */}
      <ChecklistCard />
```

- [ ] **Step 5: Type-check, lint, build**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → Expected: `17`
Run: `npx eslint src/hooks/useChecklist.ts src/components/ChecklistRow.tsx src/components/ChecklistCard.tsx src/pages/Dashboard.tsx` → Expected: no errors (pre-existing warnings in Dashboard.tsx are fine).
Run: `npm run build` → Expected: `✓ built in …`

- [ ] **Step 6: Phone check — empty state**

Build + install (Global Constraints command), open Today, scroll to below Water/Steps.
Expected: a `CHECKLIST` card reading `Track daily supplements and habits` with an `Add items` button; tapping it navigates to `/checklist` (a blank page / redirect to Today is expected until Task 4 adds the route).

- [ ] **Step 7: Phone check — ticking** (seed one item via SQL, since the add UI arrives in Task 4)

```sql
insert into public.checklist_items (user_id, name, note)
select id, 'Test vitamin', 'plan task 3' from auth.users where email = 'venkatphani2@gmail.com';
```

Relaunch the app. Expected: card shows `Test vitamin` / `plan task 3` and `0 / 1`. Tap the row → check fills, name struck through, header `All done`. Verify:

```sql
select c.checked_date from public.checklist_checks c join public.checklist_items i on i.id = c.item_id where i.name = 'Test vitamin';
```
Expected: one row, today's local date. Tap again → unticked; the same query returns no rows.
Leave the test item in place for Task 4.

- [ ] **Step 8: Report** (no commit).

---

### Task 4: Item sheet, Checklist page, route and menu entry

**Files:**
- Create: `src/components/ChecklistItemSheet.tsx`
- Create: `src/pages/Checklist.tsx`
- Modify: `src/App.tsx` (lazy import + route)
- Modify: `src/components/AppDrawer.tsx` (nav item)

**Interfaces:**
- Consumes (Task 1): `ALL_WEEKDAYS`, `addDays`, `dayProgress`, `isActiveOn`, `isChecked`, `isDue`, `scheduleLabel`, `ChecklistItem`, `ChecklistItemValues`. (Task 3): `useChecklist`, `useLocalToday`, `ChecklistRow`.
- Produces: route `/checklist`; default export `ChecklistItemSheet` with props
  `{ open: boolean; item: ChecklistItem | null; onOpenChange: (open: boolean) => void; onSave: (values: ChecklistItemValues) => Promise<boolean>; onArchive: (id: string) => Promise<boolean> }` (`item === null` → "New item").

- [ ] **Step 1: Write `src/components/ChecklistItemSheet.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ALL_WEEKDAYS, scheduleLabel, type ChecklistItem, type ChecklistItemValues } from '@/lib/checklist';

// Monday-first, matching the rest of the app's calendars.
const WEEKDAY_BUTTONS = [[1, 'M'], [2, 'T'], [3, 'W'], [4, 'T'], [5, 'F'], [6, 'S'], [0, 'S']] as const;

interface ChecklistItemSheetProps {
  open: boolean;
  item: ChecklistItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ChecklistItemValues) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
}

const ChecklistItemSheet = ({ open, item, onOpenChange, onSave, onArchive }: ChecklistItemSheetProps) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setNote(item?.note ?? '');
    setWeekdays(item?.weekdays ?? ALL_WEEKDAYS);
  }, [open, item]);

  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const canSave = name.trim().length > 0 && weekdays.length > 0 && !busy;

  // On failure the hook has already shown a toast; the sheet stays open with the typed values.
  const save = async () => {
    setBusy(true);
    const ok = await onSave({ name: name.trim(), note: note.trim() || null, weekdays: [...weekdays].sort((a, b) => a - b) });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const archive = async () => {
    if (!item || !window.confirm(`Archive "${item.name}"? It leaves your daily list; its history is kept.`)) return;
    setBusy(true);
    const ok = await onArchive(item.id);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const title = item ? 'Edit item' : 'New item';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className="space-y-4 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</div>

          <div className="space-y-2">
            <Label htmlFor="checklist-name" className="text-sm text-foreground">Name</Label>
            <Input id="checklist-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vitamin D" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checklist-note" className="text-sm text-foreground">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="checklist-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="2000 IU, after lunch" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-foreground">Repeat on</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {weekdays.length === 0 ? 'pick at least one day' : scheduleLabel(weekdays)}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_BUTTONS.map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'h-10 rounded-xl text-xs font-semibold transition-colors',
                    weekdays.includes(d) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="h-[52px] w-full rounded-[14px] bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {item && (
            <button type="button" onClick={archive} disabled={busy} className="h-11 w-full rounded-[14px] text-sm font-medium text-destructive">
              Archive
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ChecklistItemSheet;
```

- [ ] **Step 2: Write `src/pages/Checklist.tsx`**

```tsx
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
```

- [ ] **Step 3: Route + menu entry**

`src/App.tsx` — add with the other lazy imports:

```tsx
const Checklist = lazy(() => import('./pages/Checklist'));
```

and inside the `<Route path="/" element={<AppLayout />}>` block, after the `/import` route:

```tsx
          <Route path="/checklist" element={<Checklist />} />
```

`src/components/AppDrawer.tsx` — add `ListChecks` to the lucide import and make it the first nav item:

```tsx
import { Footprints, BookmarkPlus, MessagesSquare, FileSpreadsheet, ListChecks } from 'lucide-react';
…
  const navItems = [
    { path: '/checklist', icon: ListChecks, label: 'Checklist', badge: undefined },
    { path: '/import', icon: FileSpreadsheet, label: 'Import log', badge: undefined },
```

- [ ] **Step 4: Type-check, lint, logic check, build**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → Expected: `17`
Run: `npx eslint src/components/ChecklistItemSheet.tsx src/pages/Checklist.tsx src/App.tsx src/components/AppDrawer.tsx` → Expected: no errors.
Run: `npm run check:checklist` → Expected: `checklist: all checks passed`
Run: `npm run build` → Expected: `✓ built in …`

- [ ] **Step 5: Phone test — full flow** (build + install first). After each bullet, check the database with the query given.

1. Side menu shows **Checklist** first; it opens the page listing `Test vitamin` under Items with `Every day`.
2. **+ Add** → name `Test gym`, note empty, weekdays only M/W/F (label reads `Mon · Wed · Fri`) → Save. Sheet closes; item appears.
   `select name, note, weekdays from public.checklist_items where name like 'Test %' order by created_at;` → `Test gym` with `{1,3,5}`.
3. Week view: `Test gym` row shows `–` on Tue/Thu/Sat/Sun columns. Tap yesterday's column header → day panel shows that day; tick `Test vitamin` there.
   `select i.name, c.checked_date from public.checklist_checks c join public.checklist_items i on i.id = c.item_id where i.name like 'Test %';` → a row for `Test vitamin` dated yesterday.
4. Month view: yesterday's cell is solid green if everything due yesterday is ticked, else half-tone; future days are dimmed and not tappable; **›** is disabled on the current month. Tap a day two days ago → tick `Test vitamin` → re-run the query in 3: a second row.
5. Tap `Test gym` under Items → change the note to `leg day` → Save → Items shows `leg day`. Open it again → **Archive** → confirm. It disappears from Items and from today's card.
   `select name, archived_at is not null as archived from public.checklist_items where name like 'Test %';` → `Test gym` archived `true`.
6. Back on Today: the card shows today's due items (`Test vitamin` only), and ticking it still works.

- [ ] **Step 6: Clean up test data**

```sql
delete from public.checklist_items
where name like 'Test %'
  and user_id = (select id from auth.users where email = 'venkatphani2@gmail.com');
```
(Ticks are removed by `on delete cascade`.) Then `select count(*) from public.checklist_checks;` → Expected `0`.
Leave the app on the Today tab.

- [ ] **Step 7: Report** (no commit) — include what was verified on the phone and in the database.

---

## Self-review notes

- Spec coverage: data model + RLS + unique tick → Task 2; due rule incl. created/archived → Task 1; Today card incl. empty / nothing-due / all-done / midnight refresh → Task 3; page week grid (read-only cells, no future paging), month calendar (shading, future disabled), day panel, items list, sheet (weekday ≥1, archive confirm, keep-open on failure) → Task 4; errors (optimistic revert + toast, load-error state) → Tasks 3–4; testing (self-check, SQL RLS/duplicate checks, phone flow) → Tasks 1, 2, 4.
- Out of scope per spec (not in any task): reordering UI, multiple doses/day, time-of-day grouping, per-item stats, reminders, schedule history.
