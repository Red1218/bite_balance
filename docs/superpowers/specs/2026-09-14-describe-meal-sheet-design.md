# Add Meal → modal sheet + Describe flow — Design

## Goal

Implement Claude Design's `Canvas.dc.html` (project `8ece6f02-a7b3-4840-b0b3-8c7dba801961`): turn Add Meal into a swipeable bottom sheet over whatever page opened it, and add a new "Describe" input method — type a free-text meal description, get one AI parse back, review/edit it in a dedicated screen, then log. Voice input (the design's 1a "Listening" screen) is dropped — Capacitor's Android WebView doesn't support the Web Speech API, and native speech recognition is out of scope for this pass.

## Context: what exists today

- `/add-meal` is a routed page ([AddMeal.tsx](../../../src/pages/AddMeal.tsx)) with 4 tabs: Search, Indian, AI Log (a multi-turn chatbot, [ChatMealLog.tsx](../../../src/components/ChatMealLog.tsx)), Manual. Barcode scan is a button inside the Search tab, not a separate top-level method.
- Three entry points navigate to it: [BottomNav.tsx](../../../src/components/BottomNav.tsx)'s "Add" tab and raised "+" FAB, and [EmptyMealsState.tsx](../../../src/components/EmptyMealsState.tsx)'s link.
- `chat-meal` (Supabase edge function) already accepts `{ messages: {role, content}[], defaultMealTime? }` and returns `{ reply, replyOptions, items: ChatMealItem[] }` — multi-item parsing, portion inference, and curated-dish grounding already built. It's stateless per call; the frontend resends the whole conversation each turn.
- `daily_meals` and `saved_meals` tables both already have the 9 micronutrient columns (`vitamin_c, vitamin_d, vitamin_b12, iron, calcium, potassium, sodium, magnesium, zinc`, all `numeric default 0`) from a prior migration — but the `DailyMeal` and `SavedMeal` TypeScript interfaces in [useDailyMeals.ts](../../../src/hooks/useDailyMeals.ts) and [useSavedMeals.ts](../../../src/hooks/useSavedMeals.ts) were never updated to include them. This is a real gap this work needs to close (see Task list in the plan).
- `vaul` (swipeable drawer) is an installed dependency with an unused shadcn wrapper at [drawer.tsx](../../../src/components/ui/drawer.tsx) (`Drawer`, `DrawerContent`, `DrawerTrigger`, etc., built on `vaul`'s `Drawer.Root`).
- `useSavedMeals()` returns `{ meals: SavedMeal[], loading, updateMeal, deleteMeal, refetch }`.

## Explicitly out of scope

- Voice/live transcription (Canvas.dc.html's screen 1a).
- Redesigning Search or Indian tabs into a unified search-first surface (that's `CHANGES.md` item 7, a different, unapproved ask).
- Per-item amber "needs quantity" tagging from the model (would require a `chat-meal` prompt/schema change). Instead: a single banner above the review list, driven by `chat-meal`'s existing `reply`/`replyOptions` fields.
- Retiring the existing multi-turn chatbot — it stays, renamed from "AI Log" to "Chat" in the tab strip.

## Architecture

### Navigation: routed page → sheet

Drop the `/add-meal` route entirely (mobile app, no address bar, nothing else deep-links to it). `AppLayout.tsx` hosts a `Drawer` (from `drawer.tsx`) whose open state and content (`<AddMeal />`) live in a small context, `AddMealSheetContext`, exposing `openAddMeal(): void` and `closeAddMeal(): void`. `BottomNav`'s "Add" tab and "+" FAB, and `EmptyMealsState`'s button, all call `openAddMeal()` via `useAddMealSheet()` instead of navigating.

`AddMeal.tsx` drops its page chrome (the `ChevronLeft` back button, the page-level wrapper) — the Drawer's own drag handle and swipe-to-dismiss (built into `DrawerContent`/`vaul`) replace that. Its meal-time chip row and tab content stay.

### Tabs

Tab strip becomes 5 entries: **Search · Indian · Describe · Chat · Manual** (was Search · Indian · AI Log · Manual). "AI Log" is renamed "Chat" (same component, same `chat-meal` backend, unchanged behavior). "Describe" is new.

### Describe flow

New component `DescribeMealLog.tsx`, modeled on `ChatMealLog.tsx` but single-shot instead of multi-turn:

- **Compose screen:** an auto-focused textarea + "Break it down" button, plus 4 starter chips (see below). No transcript, no waveform, no mic.
- On submit, it calls `chat-meal` with `messages: [{ role: 'user', content: draftText }]` and `defaultMealTime` (the currently selected meal-time chip) — exactly one turn, no conversation history to maintain.
- **Review screen:** the returned `items` render in the same grouped-by-meal-time / macro-line / collapsible-micronutrient-grid / day-totals layout `ChatMealLog`'s review screen already has. If `data.replyOptions` comes back non-empty, an amber banner renders above the list with `data.reply` as its question and the options as quick-reply chips; tapping one re-invokes `chat-meal` with that reply appended as a second user message and refreshes `items` from the response (the running list is still whatever `chat-meal` returns — no client-side merge logic needed, mirroring how `ChatMealLog.send` already replaces `items` wholesale each call).
- Accept behavior is identical to `ChatMealLog.handleAccept`: one `daily_meals` row per item, then toast + close the sheet (not `navigate('/')`, since there's no longer a route to leave — closing the sheet reveals whatever page was behind it, which for the common case is already Today).

### Shared review UI: `MealReviewList.tsx`

Extract `ChatMealLog`'s review-screen JSX (currently inline in the `if (screen === 'review')` branch) into a new component, plus the `ChatMealItem`, `MealTime`, `MICRO`, `MEAL_ORDER`, `MEAL_LABEL`, and `fmt` types/constants it depends on — all of these move to `MealReviewList.tsx` and get imported by both `ChatMealLog.tsx` and `DescribeMealLog.tsx` (removing the duplicated copies from `ChatMealLog.tsx`).

```ts
interface MealReviewListProps {
  items: ChatMealItem[];
  onAccept: () => void;
  onBack: () => void;
  backLabel: string;       // "Something's off -- keep chatting" for Chat, "Edit description" for Describe
  saving: boolean;
  banner?: { text: string; options: string[]; onSelect: (option: string) => void };
}
```

`ChatMealLog` passes no `banner` prop (its questions already render as chat bubbles before reaching the review screen). `DescribeMealLog` passes `banner` only when the latest `chat-meal` response had non-empty `replyOptions`.

### Starter chips (Describe compose screen)

All four query data that already exists; none need a new edge function or table.

1. **"Same as yesterday"** — query `daily_meals` for the user where `logged_date` equals yesterday's date (all meal-times), map each row to a `ChatMealItem` (see mapping below), keeping each row's own `meal_time`. Skips the parse entirely — goes straight to the review screen.
2. **"Repeat last dinner"** — query `daily_meals` for the user where `meal_time = 'dinner'` and `logged_date < today`, ordered by `logged_date desc, logged_at desc`; take every row sharing the single most recent `logged_date` found. Map to `ChatMealItem`s with `mealTime` forced to the currently selected chip (not necessarily "dinner" — the user may be repeating last dinner's food into today's lunch, say). Straight to review screen.
3. **"From saved meals"** — toggles an inline list (reusing `useSavedMeals()`, already fetched) of saved meal names + calories under the chip row. Tapping one maps that `SavedMeal` to a single `ChatMealItem` at the currently selected meal-time chip and goes straight to the review screen. No new picker component — reuses the existing hook's already-loaded data.
4. **"Most logged"** — query the user's `daily_meals`, most recent 200 rows by `logged_at desc`, group client-side by `name`, take the name with the highest count, then use that name's single most recent row's macro/micro values (no averaging) as one `ChatMealItem` at the currently selected meal-time chip. Straight to review screen.

**Row → `ChatMealItem` mapping** (used by chips 1, 2, and implicitly by chip 4, which reuses a `daily_meals` row directly):

```ts
const rowToItem = (row: DailyMeal): ChatMealItem => ({
  name: row.name,
  mealTime: row.meal_time as MealTime,
  grams: 0, // daily_meals has no grams column; 0 means "unspecified" -- MealReviewList hides the portion line when grams is 0
  calories: row.calories,
  protein: row.protein,
  carbs: row.carbs,
  fat: row.fat,
  fiber: row.fiber ?? 0,
  vitaminC: row.vitamin_c ?? 0,
  vitaminD: row.vitamin_d ?? 0,
  vitaminB12: row.vitamin_b12 ?? 0,
  iron: row.iron ?? 0,
  calcium: row.calcium ?? 0,
  potassium: row.potassium ?? 0,
  sodium: row.sodium ?? 0,
  magnesium: row.magnesium ?? 0,
  zinc: row.zinc ?? 0,
});
```

This requires `DailyMeal` (and `SavedMeal`, for chip 3) to actually carry the 9 micronutrient fields — see the interface-extension task below.

`MealReviewList`'s item row renders `{it.grams} g` under the item name only when `grams > 0` — chip-sourced items (which have no real portion data to show) omit that line entirely rather than showing a fabricated value. Items from an actual `chat-meal` parse always have a real `grams` and always show it, unchanged from today's behavior.

Chip 3 maps `SavedMeal` (which has no `meal_time` of its own) the same way, with `mealTime` taken from the currently selected chip:

```ts
const savedMealToItem = (meal: SavedMeal, mealTime: MealTime): ChatMealItem => ({
  name: meal.name,
  mealTime,
  grams: 0,
  calories: meal.calories,
  protein: meal.protein,
  carbs: meal.carbs,
  fat: meal.fat,
  fiber: meal.fiber ?? 0,
  vitaminC: meal.vitamin_c ?? 0,
  vitaminD: meal.vitamin_d ?? 0,
  vitaminB12: meal.vitamin_b12 ?? 0,
  iron: meal.iron ?? 0,
  calcium: meal.calcium ?? 0,
  potassium: meal.potassium ?? 0,
  sodium: meal.sodium ?? 0,
  magnesium: meal.magnesium ?? 0,
  zinc: meal.zinc ?? 0,
});
```

## Data model changes

None. No new tables, no new migrations. Two existing TypeScript interfaces need extending to match columns their tables already have:

- `DailyMeal` in [useDailyMeals.ts](../../../src/hooks/useDailyMeals.ts): add the same 9 optional micronutrient fields `ChatMealItem` already has (`vitamin_c?`, `vitamin_d?`, `vitamin_b12?`, `iron?`, `calcium?`, `potassium?`, `sodium?`, `magnesium?`, `zinc?`), snake_case to match the DB column names (unlike `ChatMealItem`, which is camelCase — these interfaces mirror the DB rows directly).
- `SavedMeal` in [useSavedMeals.ts](../../../src/hooks/useSavedMeals.ts): same 9 fields added.

## Backend changes

None. `chat-meal` is reused as-is for Describe's single-shot parse.

## Files touched

- New: `src/components/MealReviewList.tsx`, `src/components/DescribeMealLog.tsx`, `src/contexts/AddMealSheetContext.tsx`
- Modified: `src/components/ChatMealLog.tsx` (use `MealReviewList`, drop the now-duplicated types/review JSX), `src/pages/AddMeal.tsx` (drop page chrome, add Describe tab, rename AI Log → Chat), `src/components/AppLayout.tsx` (host the `Drawer` + provider), `src/components/BottomNav.tsx`, `src/components/EmptyMealsState.tsx`, `src/App.tsx` (drop the `/add-meal` route), `src/hooks/useDailyMeals.ts`, `src/hooks/useSavedMeals.ts`

## Error handling

Same patterns already established: `chat-meal` failures surface as a toast + a retry-invite message (mirrors `ChatMealLog`'s existing catch block); `daily_meals` insert failures on Accept show a destructive toast and leave the review screen open (mirrors `ChatMealLog.handleAccept`'s existing catch block). Starter-chip queries that error show a destructive toast via the existing `useToast` pattern already used in `useDailyMeals`/`useSavedMeals`.

## Testing / verification

1. `npx tsc --noEmit` and `npm run build` clean.
2. In the Browser tool: open the sheet from all three entry points (BottomNav "Add" tab, "+" FAB, `EmptyMealsState` button); confirm swipe-down dismisses it and reveals the page behind it.
3. Describe end-to-end: type a multi-item sentence, confirm "Break it down" reaches the review screen with correct items; test each of the 4 starter chips independently; test the amber banner path by describing something genuinely ambiguous and confirming a quick-reply resolves it; Accept and confirm rows land correctly on the Dashboard.
4. Confirm Search, Indian, Chat, and Manual tabs still work unchanged inside the sheet.
5. Both themes (dark/light).
6. Rebuild the debug APK and verify on-device.
