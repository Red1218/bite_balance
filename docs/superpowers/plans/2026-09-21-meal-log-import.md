# Import Meal Logs from Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick a ChatGPT-generated `.xlsx` daily meal log, review the parsed items in the app's existing review UI, and log them to `daily_meals` in one action — with a same-date re-import replacing only what an earlier import added.

**Architecture:** A pure parsing module (`src/lib/importMealLog.ts`, no React/Supabase) turns raw `.xlsx` bytes into `{ loggedDate, items: ChatMealItem[] }`. A new page (`src/pages/Import.tsx`) drives a plain `<input type="file">`, feeds the bytes to that module, renders the result through the already-existing `MealReviewList` component unmodified, and on accept does a delete-then-insert against `daily_meals` scoped by a new `source` column so re-imports don't duplicate rows.

**Tech Stack:** React + TypeScript + Vite, `xlsx` (SheetJS) for parsing, Supabase (Postgres + JS client), existing `MealReviewList`/`chatMealItemToRow`.

**Spec:** [docs/superpowers/specs/2026-09-21-meal-log-import-design.md](../specs/2026-09-21-meal-log-import-design.md)

## Global Constraints

- No AI/food-database lookup for macros — map the sheet's own columns directly; a missing macro column defaults that field to `0`.
- Scoped to the two-tab "Today's Meals" / "Daily Summary" shape described in the spec — a differently-shaped file should fail to parse with a clear error, not guess.
- `source` column on `daily_meals` is nullable, no default, no backfill — every other insert path (chat, manual, saved) stays untouched.
- This repo has no test runner. Verification is `npx tsc --noEmit` + `npm run build` + concrete functional checks against the real sample files, matching how every other feature in this codebase is verified.

---

## Task 1: Add the `xlsx` dependency

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `xlsx` importable as `import * as XLSX from 'xlsx'` in later tasks (its own TypeScript types ship in the package).

- [ ] **Step 1: Install the dependency**

```bash
npm install xlsx
```

- [ ] **Step 2: Verify it installed and the project still type-checks and builds**

```bash
npx tsc --noEmit
npm run build
```

Expected: both commands exit with no errors (same as before the install — this step only proves the install didn't break anything; `xlsx` isn't imported anywhere yet).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add xlsx dependency for meal-log import"
```

---

## Task 2: Migration — `daily_meals.source`

**Files:**
- Create: `supabase/migrations/20260921000000_add_daily_meals_source.sql`

**Interfaces:**
- Produces: a nullable `source text` column on `public.daily_meals`, written only by Task 4's import flow (value `'import'`). No other insert path is touched.

- [ ] **Step 1: Write the migration**

```sql
alter table public.daily_meals add column source text;
```

- [ ] **Step 2: Apply it and verify the column exists**

Use the Supabase MCP's `apply_migration` (name: `add_daily_meals_source`, the SQL above), then confirm with:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'daily_meals' and column_name = 'source';
```

Expected: one row — `source | text | YES`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260921000000_add_daily_meals_source.sql
git commit -m "Add nullable source column to daily_meals for import tracking"
```

---

## Task 3: Parsing module — `src/lib/importMealLog.ts`

**Files:**
- Create: `src/lib/importMealLog.ts`

**Interfaces:**
- Consumes: `ChatMealItem`, `MealTime` types from `src/components/MealReviewList.tsx` (already exported there — see [MealReviewList.tsx:6](../../../src/components/MealReviewList.tsx#L6) and [:17](../../../src/components/MealReviewList.tsx#L17)).
- Produces:
  - `parseMealTime(mealCell: unknown): MealTime`
  - `parseGrams(quantity: unknown): number | null`
  - `parseMealLogFile(buffer: ArrayBuffer): ParsedImport` where `interface ParsedImport { loggedDate: string; items: ChatMealItem[] }`. Throws a plain `Error` with a user-facing message on any malformed input (missing sheet, missing Date row, no food rows).

- [ ] **Step 1: Write the module**

```ts
import * as XLSX from 'xlsx';
import type { ChatMealItem, MealTime } from '@/components/MealReviewList';

export interface ParsedImport {
  loggedDate: string;
  items: ChatMealItem[];
}

const MEAL_TIME_KEYWORDS: { mealTime: MealTime; keyword: string }[] = [
  { mealTime: 'breakfast', keyword: 'breakfast' },
  { mealTime: 'lunch', keyword: 'lunch' },
  { mealTime: 'dinner', keyword: 'dinner' },
  { mealTime: 'snack', keyword: 'snack' },
];

// "Meal 1 - Lunch" -> 'lunch'; no keyword match -> 'snack' (same fallback chat-meal uses).
export const parseMealTime = (mealCell: unknown): MealTime => {
  const text = String(mealCell ?? '').toLowerCase();
  const match = MEAL_TIME_KEYWORDS.find((m) => text.includes(m.keyword));
  return match ? match.mealTime : 'snack';
};

// "100 g" -> 100. Anything else ("3", "1 spray", a fraction-of-batch note) -> null: not a weight.
export const parseGrams = (quantity: unknown): number | null => {
  const text = String(quantity ?? '').trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  return match ? parseFloat(match[1]) : null;
};

const ZERO_MICROS = {
  vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0, calcium: 0,
  potassium: 0, sodium: 0, magnesium: 0, zinc: 0,
};

interface MealRow {
  Meal?: unknown;
  Food?: unknown;
  Quantity?: unknown;
  'Calories (kcal)'?: unknown;
  'Protein (g)'?: unknown;
  'Carbs (g)'?: unknown;
  'Fat (g)'?: unknown;
  'Fiber (g)'?: unknown;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Reads the "Date" key/value row from Daily Summary regardless of whether that
// sheet has its own header row first -- the two real sample files disagree on
// that, so this searches for the row by its first cell instead of a fixed index.
const findDailySummaryDate = (workbook: XLSX.WorkBook): string => {
  const sheet = workbook.Sheets['Daily Summary'];
  if (!sheet) throw new Error('This file has no "Daily Summary" sheet.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const dateRow = rows.find((row) => String(row[0] ?? '').trim().toLowerCase() === 'date');
  if (!dateRow || dateRow[1] == null) {
    throw new Error('No "Date" row found in the "Daily Summary" sheet.');
  }
  const value = dateRow[1];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not read the date "${text}" from the "Daily Summary" sheet.`);
  }
  return parsed.toISOString().split('T')[0];
};

export const parseMealLogFile = (buffer: ArrayBuffer): ParsedImport => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const mealsSheet = workbook.Sheets["Today's Meals"];
  if (!mealsSheet) throw new Error('This file has no "Today\'s Meals" sheet.');
  const rows = XLSX.utils.sheet_to_json<MealRow>(mealsSheet);

  const items: ChatMealItem[] = rows
    .filter((row) => {
      const food = String(row.Food ?? '').trim();
      const hasQuantity = row.Quantity != null && String(row.Quantity).trim().length > 0;
      return food.length > 0 && food.toUpperCase() !== 'TOTAL' && hasQuantity;
    })
    .map((row) => {
      const food = String(row.Food ?? '').trim();
      const quantityText = String(row.Quantity ?? '').trim();
      const grams = parseGrams(quantityText);
      return {
        name: grams === null ? `${food} (${quantityText})` : food,
        mealTime: parseMealTime(row.Meal),
        grams: grams ?? 0,
        calories: num(row['Calories (kcal)']),
        protein: num(row['Protein (g)']),
        carbs: num(row['Carbs (g)']),
        fat: num(row['Fat (g)']),
        fiber: num(row['Fiber (g)']),
        ...ZERO_MICROS,
      };
    });

  if (items.length === 0) throw new Error('No food rows found in "Today\'s Meals".');

  return { loggedDate: findDailySummaryDate(workbook), items };
};
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. (This only proves the module compiles — Task 4 exercises it against real data, since running it standalone would need a bundler to resolve the `@/` import alias that isn't available to plain Node.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/importMealLog.ts
git commit -m "Add pure parser for ChatGPT-exported meal log Excel files"
```

---

## Task 4: Import page — `src/pages/Import.tsx`

**Files:**
- Create: `src/pages/Import.tsx`

**Interfaces:**
- Consumes: `parseMealLogFile` from `src/lib/importMealLog.ts` (Task 3); `MealReviewList`, `ChatMealItem`, `chatMealItemToRow` from `src/components/MealReviewList.tsx` (props: `items: ChatMealItem[]`, `onAccept: () => void`, `onBack: () => void`, `onChangeMealTime: (idx: number, mealTime: MealTime) => void`, `backLabel: string`, `saving: boolean` — see [MealReviewList.tsx:76-87](../../../src/components/MealReviewList.tsx#L76-L87)); `useAuth` from `@/contexts/AuthContext`; `useToast` from `@/hooks/use-toast`; `useAddMealSheet` from `@/contexts/AddMealSheetContext` (for `notifyMealsLogged()`, the same signal `ChatMealLog.tsx` fires after logging — see [ChatMealLog.tsx:447](../../../src/components/ChatMealLog.tsx#L447)); `useNavigate` from `react-router-dom`.
- Produces: default-exported `Import` component, to be routed at `/import` in Task 5.

- [ ] **Step 1: Write the page**

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import MealReviewList, { ChatMealItem, MealTime, chatMealItemToRow } from '@/components/MealReviewList';
import { parseMealLogFile } from '@/lib/importMealLog';

const Import = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyMealsLogged } = useAddMealSheet();
  const navigate = useNavigate();

  const [items, setItems] = useState<ChatMealItem[] | null>(null);
  const [loggedDate, setLoggedDate] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setItems(null);
    setLoggedDate(null);
    setFileName(null);
    setError(null);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseMealLogFile(buffer);
      setItems(parsed.items);
      setLoggedDate(parsed.loggedDate);
    } catch (err) {
      console.error('Error parsing meal log file:', err);
      setError(err instanceof Error ? err.message : 'Could not read that file.');
      setItems(null);
      setLoggedDate(null);
    }
  };

  const handleChangeMealTime = (idx: number, mealTime: MealTime) => {
    setItems((prev) => (prev ? prev.map((it, i) => (i === idx ? { ...it, mealTime } : it)) : prev));
  };

  const handleImport = async () => {
    if (!user || !items || !loggedDate) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('daily_meals')
        .delete()
        .eq('user_id', user.id)
        .eq('logged_date', loggedDate)
        .eq('source', 'import');
      if (deleteError) throw deleteError;

      const rows = items.map((item) => ({ ...chatMealItemToRow(item, user.id, loggedDate), source: 'import' }));
      const { error: insertError } = await supabase.from('daily_meals').insert(rows);
      if (insertError) throw insertError;

      toast({ title: 'Imported', description: `Logged ${items.length} item${items.length === 1 ? '' : 's'} for ${loggedDate}.` });
      notifyMealsLogged();
      navigate('/');
    } catch (err) {
      console.error('Error importing meal log:', err);
      toast({ title: 'Error', description: 'Failed to import. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (items && loggedDate) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Import log</h1>
          <p className="text-xs text-muted-foreground">{fileName} · {loggedDate}</p>
        </div>
        <MealReviewList
          items={items}
          onAccept={handleImport}
          onBack={reset}
          onChangeMealTime={handleChangeMealTime}
          backLabel="Choose a different file"
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/12 border border-primary/28">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Import log</h1>
          <p className="text-xs text-muted-foreground">Import a day's meals from an Excel sheet.</p>
        </div>
      </div>

      <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 text-center">
        {saving ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <FileSpreadsheet className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Tap to choose an .xlsx file</span>
          </>
        )}
        <input
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
            e.target.value = '';
          }}
        />
      </label>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          {error}
        </div>
      )}
    </div>
  );
};

export default Import;
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no errors. The page isn't routed yet (Task 5), so it won't be reachable in the running app until then — this step only confirms it compiles cleanly on its own.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Import.tsx
git commit -m "Add Import page: file picker, parse, review, log"
```

---

## Task 5: Route it — `src/App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Import` default export from `src/pages/Import.tsx` (Task 4).
- Produces: route `/import` reachable inside `AppLayout`'s `Outlet`, same lazy-loaded pattern as every other page.

- [ ] **Step 1: Add the lazy import**

In `src/App.tsx`, next to the other `lazy(() => import(...))` page imports:

```tsx
const Import = lazy(() => import('./pages/Import'));
```

- [ ] **Step 2: Add the route**

Inside the `<Routes>` block, alongside the other `<Route path="/...">` entries under `AppLayout`:

```tsx
<Route path="/import" element={<Import />} />
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "Route /import to the new Import page"
```

---

## Task 6: Drawer entry — `src/components/AppDrawer.tsx`

**Files:**
- Modify: `src/components/AppDrawer.tsx`

**Interfaces:**
- Consumes: the `/import` route (Task 5).
- Produces: a reachable "Import log" entry in the app's hamburger drawer.

- [ ] **Step 1: Import the icon**

```tsx
import { Footprints, BookmarkPlus, MessagesSquare, FileSpreadsheet } from 'lucide-react';
```

- [ ] **Step 2: Add the nav item**

In `AppDrawer.tsx`'s `navItems` array, add an entry ahead of the existing ones (this is the most frequently-used one, per the daily-import workflow):

```tsx
const navItems = [
  { path: '/import', icon: FileSpreadsheet, label: 'Import log', badge: undefined },
  { path: '/conversations', icon: MessagesSquare, label: 'Conversations', badge: undefined },
  { path: '/saved-meals', icon: BookmarkPlus, label: 'Saved', badge: undefined },
  { path: '/steps', icon: Footprints, label: 'Steps', badge: isConnected && healthData ? healthData.steps.toLocaleString() : undefined },
] as const;
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppDrawer.tsx
git commit -m "Add Import log entry to the app drawer"
```

---

## Task 7: End-to-end functional verification

No new files — this exercises Tasks 1-6 together against the two real sample files, since this repo has no test runner and this is the point where the parsing module is actually driven by real data for the first time.

**Files:** none (verification only).

- [ ] **Step 1: Sync and install on a device/emulator**

```bash
npx cap sync android
cd android && ./gradlew.bat installDebug
```

Confirm it installs without error on at least one connected device or emulator (`adb devices` should list it first).

- [ ] **Step 2: Import the macro-complete sample file**

In the app: open the drawer → "Import log" → tap the file picker → select the fuller sample file (the one with Protein/Carbs/Fat/Fiber columns, `Meal 1 - Lunch` for all 7 rows, dated 2026-09-21).

Confirm the file picker actually opens (this is the one platform behavior the design flagged as unverified until now — if it doesn't, stop and report back rather than adding a native file-picker plugin unprompted, since that's a scope change from the spec).

Confirm the review screen shows exactly these 7 items, all under "Lunch":

| Name | Grams shown | Calories | P / C / F / Fib |
|---|---|---|---|
| Raw rice | 100 g | 360 | 7 / 80 / 0.7 / 0.6 |
| Carrot | 50 g | 20 | 0.5 / 4.8 / 0.1 / 1.4 |
| Potato | 50 g | 39 | 1 / 8.7 / 0.1 / 1.1 |
| Brinjal-tomato curry (¼ batch) | no grams shown | 81 | 2.5 / 16.3 / 2.2 / 5.7 |
| Curd | 100 g | 63 | 3.5 / 4.7 / 3 / 0 |
| Eggs (3) | no grams shown | 216 | 18.9 / 1.1 / 14.4 / 0 |
| Oil (1 spray) | no grams shown | 8 | 0 / 0 / 0.9 / 0 |

Day total should read 787 kcal (matches the sheet's own "Logged calories" value).

- [ ] **Step 3: Accept and verify the database**

Tap "Accept & log 7 items across 1 meal-time". Confirm the success toast, then check the database:

```sql
select name, meal_time, grams, calories, source
from daily_meals
where logged_date = '2026-09-21' and source = 'import'
order by name;
```

Expected: 7 rows, `source = 'import'` on all of them, names/calories matching the table above (grams `null` for the three no-grams rows).

- [ ] **Step 4: Verify re-import replaces, not duplicates**

Re-import the same file a second time (drawer → Import log → same file). Confirm the review screen again shows exactly 7 items (not 14), accept again, then re-run the query from Step 3 — still exactly 7 rows for `logged_date = '2026-09-21' and source = 'import'`, not 14.

- [ ] **Step 5: Verify manual/chat entries for the same day are untouched**

Before or after the above, log one item for 2026-09-21 through the normal Chat or Manual flow (a different `logged_date` is fine too if today isn't 2026-09-21 at verification time — the point is confirming a non-import row on that date survives). Re-run Step 4's re-import. Confirm that manually-logged row is still present afterward (only `source = 'import'` rows were deleted and replaced).

- [ ] **Step 6: Import the calorie-only sample file (different date)**

Repeat Step 2 with the first sample file (5 columns, no macro columns). Confirm it still parses and the review screen shows 7 items with macros at 0 — proving the missing-column defaulting works, not just the full-column case.

- [ ] **Step 7: Report results**

If every check above passed, this plan is complete. If something didn't match (especially the file picker not opening, or any expected value differing), stop and report the specific mismatch rather than silently adjusting the design.
