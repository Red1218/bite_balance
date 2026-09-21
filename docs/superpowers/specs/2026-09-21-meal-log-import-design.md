# Import meal logs from a ChatGPT-generated Excel sheet — Design

## Goal

The user has been logging meals with ChatGPT while the app's own chat isn't yet doing exactly what they want. ChatGPT exports a daily `.xlsx` sheet; the user wants to hand that file to the app and have it read and log the day's meals — a routine, once-a-day habit, not a one-time historical backfill.

## Context: what exists today

- Two real sample files were inspected (`meal_log_2026-09-21.xlsx`, two versions). Both have two sheets:
  - **"Today's Meals"**: columns `Meal | Food | Quantity | Calories (kcal) | [Protein (g) | Carbs (g) | Fat (g) | Fiber (g)] | Notes`. The macro columns are present in the version the user will actually use going forward; an earlier version had calories only. `Meal` is free text ("Meal 1 - Lunch"), not an enum. `Quantity` is inconsistent — `"100 g"`, a bare `"3"` (count, no unit), `"1 spray"`, `"¼ batch"`. Each meal group ends with a `TOTAL` pseudo-row (Food = "TOTAL", Quantity blank).
  - **"Daily Summary"**: key/value rows including `Date` (e.g. `2026-09-21`), calorie target/logged/remaining, and (in the fuller version) the day's macro totals and free-text status/notes.
- `daily_meals` ([migration](../../../supabase/migrations/20251124052650_beaaba96-4e45-47cb-945b-8a44fd05b241.sql) + later additions) has `name, calories, protein, carbs, fat, fiber, meal_time, logged_date, logged_at, grams, unit`, plus 9 micronutrient columns (`vitamin_c, vitamin_d, vitamin_b12, iron, calcium, potassium, sodium, magnesium, zinc`, all `numeric default 0`). No column distinguishes how a row was created (chat / manual / saved / import).
- `MealReviewList.tsx` already renders a `ChatMealItem[]` grouped by meal-time with per-item meal-time reassignment, collapsible micronutrients, day totals, and a single accept action. With `onlyMealTime` omitted it already renders **all** meal-times at once with one `Accept & log N items across M meal-times` button calling a single `onAccept()` — this is exactly the shape an import needs, and needs no changes.
- `chatMealItemToRow(item, userId, loggedDate)` (same file) maps a `ChatMealItem` to a `daily_meals` insert row, and already does `grams: item.grams || null` — a falsy `grams` becomes SQL `null`, which the rest of the app already treats as "amount unknown" (grams column added in [20260917000000_add_daily_meals_grams.sql](../../../supabase/migrations/20260917000000_add_daily_meals_grams.sql)).
- No spreadsheet-parsing dependency exists in `package.json`. No `<input type="file">` exists anywhere in the app yet. `capacitor.config.ts` has no custom WebView client override, so Capacitor's default Android bridge (which implements `onShowFileChooser`) should handle a plain file input without a native plugin — to be confirmed on-device during implementation, not assumed.
- The drawer ([AppDrawer.tsx](../../../src/components/AppDrawer.tsx)) currently lists Conversations, Saved, Steps.

## Explicitly out of scope

- Multi-day historical backfill (confirmed: one file per day, imported routinely, not a bulk historical dump).
- AI or food-database lookup to fill in missing macros — the real sheet the user will use already has full macros; a calorie-only sheet just imports with macros at 0 (matches the schema's own defaults, same as any other zero-macro entry).
- A generic, format-agnostic spreadsheet importer. This is scoped to the two-tab shape above; a sheet with a meaningfully different structure fails to parse rather than guessing.
- Validating parsed totals against the "Daily Summary" sheet's own stated totals. `MealReviewList` already surfaces computed day totals for the user to eyeball before accepting; adding a second automated cross-check is unrequested complexity.

## Architecture

### New dependency: `xlsx` (SheetJS)

Only real option for parsing `.xlsx` client-side in a WebView; no stdlib/native equivalent, nothing already installed covers it.

### Migration: `daily_meals.source`

```sql
alter table public.daily_meals add column source text;
```

Nullable, no default, no backfill. Every existing insert path (chat, manual, saved-meal quick-add) is untouched and continues to insert `source = null`. Only the new import path ever writes `'import'`. This is what makes "re-importing the same date replaces only what an earlier import added" safe — the delete-before-insert step (below) only ever touches rows this feature itself created.

### `src/pages/Import.tsx` (new route `/import`)

1. `<input type="file" accept=".xlsx">`. On change, read the file as an `ArrayBuffer`, parse with `xlsx`'s `read()`.
2. From "Today's Meals": drop the header row and any row where `Food` is `"TOTAL"` (case-insensitive) or `Quantity` is blank. Map each remaining row to a `ChatMealItem` (imported from `MealReviewList.tsx`, not redefined):
   - `name`: `Food`, trimmed. If `Quantity` doesn't parse to a plain gram weight (next bullet), the raw quantity is appended in parens — `"Eggs (3)"`, `"Oil (1 spray)"`, `"Brinjal-tomato curry (¼ batch)"` — so the information isn't silently dropped.
   - `grams`: parsed only when `Quantity` matches `/^(\d+(?:\.\d+)?)\s*g$/i`; otherwise `0` (→ `null` via `chatMealItemToRow`'s existing conversion).
   - `mealTime`: lowercase the `Meal` cell and match `breakfast|lunch|dinner|snack`; no match → `'snack'` (same fallback default used in `chat-meal`).
   - `calories/protein/carbs/fat/fiber`: read straight from the matching columns; a missing column (the calorie-only sheet variant) defaults that field to `0`.
   - The 9 micronutrient fields: always `0` (not present in either sheet variant).
3. From "Daily Summary": read the `Date` row's value as `logged_date` for the whole batch. (Using the file's own stated date, not `new Date()`, so an import done after midnight still lands on the right day.) The cell may come back as a plain string (as in both samples) or, depending on how the sheet was saved, as a real Excel date — parse with `xlsx`'s `cellDates: true` and handle both: a `Date` instance formats via `.toISOString().split('T')[0]`, a string is used as-is if it already matches `YYYY-MM-DD`, otherwise `new Date(value)` as a fallback.
4. Render the mapped items through `<MealReviewList items={...} onAccept={handleImport} onBack={...} backLabel="Choose a different file" saving={importing} />` — no `onlyMealTime`, so it's the existing all-meal-times review/accept screen, unmodified.
5. `handleImport`: `supabase.from('daily_meals').delete().eq('user_id', user.id).eq('logged_date', loggedDate).eq('source', 'import')`, then insert every mapped item via `chatMealItemToRow(item, user.id, loggedDate)` spread with `source: 'import'` added. Toast + `notifyMealsLogged()` (same signal `ChatMealLog`/`AddMeal` already fire, matching [AddMealSheetContext](../../../src/contexts/AddMealSheetContext.tsx)'s existing consumers like Dashboard/Chat's day meter), then navigate back to `/`.
6. A malformed file (missing sheet, unreadable, wrong shape) shows an inline error and lets the user pick a different file — no partial/best-effort parse.

### Drawer entry

`AppDrawer.tsx`'s `navItems` gets one more entry, `{ path: '/import', icon: FileSpreadsheet (or similar), label: 'Import log' }`, alongside Conversations/Saved/Steps.

## Testing

- Both sample files (macro-complete and calorie-only) parse without error; the calorie-only one imports with macros at 0.
- A row with a non-gram quantity (`"3"`, `"1 spray"`, `"¼ batch"`) shows up in the review screen with the quantity folded into the name and no grams shown (matching the existing "amount unknown" treatment elsewhere).
- Re-importing the same date's (edited) file replaces the previous import's rows rather than duplicating them, while a manually-logged or chat-logged meal from that same day is left alone.
- File input actually opens Android's file picker on-device (the one real platform unknown here) — verified during implementation, not assumed from the design alone.
