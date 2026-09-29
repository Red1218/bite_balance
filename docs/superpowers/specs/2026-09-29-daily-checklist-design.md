# Daily checklist — design

**Date:** 2026-09-29 · **Status:** approved in chat, awaiting spec review

## Goal

A daily checklist for recurring tasks and supplements ("Vitamin D", "Stretch 10 min").
Tick items off as you do them; see and fix the record week by week and month by month.

## Decisions

| Question | Decision |
|---|---|
| How items repeat | Every day by default; optionally only on chosen weekdays. No multiple-times-a-day. |
| What an item holds | Name + optional note (dose, timing reminder). No time-of-day grouping. |
| Where you tick | A card on the Today screen. Managing items and history live on a new Checklist page in the side menu. |
| History views | Week: item × day grid. Month: calendar shaded by completion. |
| Past days | Any past day can be ticked/unticked. Future days are locked. |
| Storage | Two tables: items + one row per tick. |

## Data model

```sql
create table checklist_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  note        text,
  weekdays    smallint[] not null default '{0,1,2,3,4,5,6}',  -- 0 = Sun … 6 = Sat
  position    int not null default 0,
  created_at  timestamptz not null default now(),
  archived_at timestamptz
);

create table checklist_checks (
  item_id      uuid not null references checklist_items on delete cascade,
  user_id      uuid not null references auth.users on delete cascade,
  checked_date date not null,               -- the user's local calendar day
  created_at   timestamptz not null default now(),
  primary key (item_id, checked_date)
);
```

- RLS on both tables: a user can select/insert/update/delete only rows where `user_id = auth.uid()`
  (same pattern as `water_logs` / `daily_meals`).
- Tick = insert a row (upsert, so a double tap is harmless). Untick = delete it.
- `position` is set to "last" on insert; no reorder UI yet.
- Regenerate `src/integrations/supabase/types.ts` after the migration.

## "Due" rule

An item is **due** on local day `D` when all hold:

1. `weekdays` contains `D`'s weekday,
2. `D` ≥ the local date of `created_at`,
3. `archived_at` is null, or `D` < the local date of `archived_at`.

A due item with a tick is **done**; without one it's **missed**. Days before creation, after
archiving, or off-schedule are **not scheduled** and never count as missed.

**Known limit:** editing an item's weekdays re-judges past days by the new schedule.
Keeping schedule history is out of scope until that proves to matter.

All dates are local (`fmtLocalDate`), never `toISOString()`.

## Units

- **`src/lib/checklist.ts`** — pure logic, no React/Supabase: `isDue(item, date)`,
  `dayProgress(items, checks, date) → { done, due }`, `scheduleLabel(weekdays)`
  ("Every day" / "Mon · Wed · Fri"), types `ChecklistItem`, `ChecklistCheck`.
- **`src/hooks/useChecklist.ts`** — loads active + archived items and checks for a date range;
  `toggle(itemId, date)` (optimistic, reverts + toasts on error), `saveItem`, `archiveItem`.
- **`src/components/ChecklistCard.tsx`** — the Today card.
- **`src/pages/Checklist.tsx`** — the page (views + day panel + items list).
- **`src/components/ChecklistItemSheet.tsx`** — add/edit sheet (bottom drawer).
- Wiring: route `/checklist` in `App.tsx`, "Checklist" entry in `AppDrawer.tsx`,
  `<ChecklistCard />` below `<WaterTracker />` in `Dashboard.tsx`.

## Today card

- Full width, below the Water card.
- Header: "CHECKLIST"; right side shows `done / due` (turns into "All done" in green) and an
  "All ›" link to `/checklist`.
- Rows: items due today in `position` order — round check, name, note in small muted text.
  Whole row toggles. Ticked rows stay in place, check filled, name muted + struck through.
- Empty (no items): "Track daily supplements and habits" + "Add items" button → `/checklist`.
- Nothing due today: "Nothing scheduled today".
- Recomputes "today" when the app is resumed/refocused after midnight.

## Checklist page

- Header "Checklist" + "+ Add" button; Week / Month toggle styled like History's.
- **Week view:** rows = items that were active at any point in the shown 7 days; columns = the
  7 days ending today (‹ › pages back by week; no paging into the future). Cells are read-only:
  ● done, ○ missed, faint – not scheduled. Column header shows `done/due`; today's column has a
  dashed outline.
- **Month view:** calendar like History's. Each day shaded by completion — none (grey),
  some (half-tone), all (solid); days with nothing due and future days are plain.
- **Day panel:** tapping a week column header or a calendar day selects that date (future days
  disabled). Below the view, the panel lists that day's due items with checkboxes to tick/untick.
  Defaults to today.
- **Items list:** active items with name, note and `scheduleLabel`. Tap → edit sheet.
- **Item sheet:** name (required), note, 7 weekday toggles (all on by default; at least one
  required), Save; Archive (with confirm) when editing. Save failure keeps the sheet open with
  the typed values and shows a toast.

## Errors

- Toggles are optimistic; on failure they revert and show a destructive toast.
- Load failure shows an error state, never an empty list.
- Archive asks for confirmation.

## Testing

- `src/lib/checklist.check.ts`: assert-based self-check for `isDue` / `dayProgress` /
  `scheduleLabel` — weekday schedules, items created/archived mid-week, a day just after local
  midnight in IST. Run by bundling with the already-installed esbuild and executing with
  `TZ=Asia/Kolkata node`.
- Database: after applying the migration, verify via SQL that RLS scopes rows to the owner and the
  primary key rejects a duplicate tick.
- On the phone: add a test item, tick/untick on Today, fix a past day from both the week grid and
  the month calendar, archive it — checking the database after each step — then delete the test
  item and its ticks.

## Out of scope

Reordering UI, multiple doses per day, time-of-day grouping, per-item streaks/stats, reminders or
notifications, schedule history.
