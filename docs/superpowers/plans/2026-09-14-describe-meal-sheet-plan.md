# Add Meal Sheet + Describe Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Add Meal from a routed page into a swipeable bottom sheet reachable from any page, and add a new single-shot "Describe" input method (type a meal description → AI parse → editable review screen) alongside the existing multi-turn "Chat".

**Architecture:** A new `AddMealSheetContext` (open/close state) is provided near the app root so both routing-adjacent code (the hardware back-button handler) and deeply nested UI (BottomNav, EmptyMealsState, AddMeal's own Manual-tab submit) can open/close the sheet. `AppLayout` hosts a `vaul`-backed `Drawer` whose content is the existing `AddMeal` page component with its page chrome stripped out. A new `MealReviewList` component is extracted from `ChatMealLog`'s existing review screen so both `ChatMealLog` and the new `DescribeMealLog` share one editable-review UI. `DescribeMealLog` reuses the already-deployed `chat-meal` edge function for its single-shot parse — no backend changes.

**Tech Stack:** React 18 + TypeScript + Vite, Tailwind CSS + shadcn-ui, `vaul` (already an installed dependency, previously unused) for the swipeable drawer, Supabase JS client, existing `chat-meal` edge function (unchanged).

**Spec:** [docs/superpowers/specs/2026-09-14-describe-meal-sheet-design.md](../specs/2026-09-14-describe-meal-sheet-design.md)

## Global Constraints

- No new npm dependencies — `vaul`/`drawer.tsx` already exist and cover the swipeable-sheet requirement.
- No new database migrations or edge functions — `chat-meal`, `daily_meals`, and `saved_meals` already have everything needed.
- This codebase has no automated test framework (no vitest/jest in `package.json`) and no existing feature in it has unit tests — every prior feature (including the `chat-meal` chatbot itself) was verified via `npx tsc --noEmit`, `npm run build`, manual walkthroughs in the Browser tool, and an on-device APK check. This plan follows that same established pattern rather than introducing a new test framework unprompted; each task's automated gate is `npx tsc --noEmit` passing, with full functional verification in the final task.
- Drop the `/add-meal` route entirely — this is a Capacitor mobile app with no address bar for users, and nothing external deep-links to it.
- `MealReviewList` hides an item's portion-size line (`{grams} g`) when `grams` is `0` rather than showing a fabricated value — `daily_meals` rows have no stored portion size.

---

### Task 1: `AddMealSheetContext` — sheet open/close state

**Files:**
- Create: `src/contexts/AddMealSheetContext.tsx`

**Interfaces:**
- Produces: `AddMealSheetProvider` (component, wraps `children: ReactNode`), `useAddMealSheet()` hook returning `{ open: boolean; openAddMeal: () => void; closeAddMeal: () => void }`. Every later task that needs to open or close the sheet imports `useAddMealSheet` from this file.

- [ ] **Step 1: Create the context, provider, and hook**

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

interface AddMealSheetContextValue {
  open: boolean;
  openAddMeal: () => void;
  closeAddMeal: () => void;
}

const AddMealSheetContext = createContext<AddMealSheetContextValue | null>(null);

export const AddMealSheetProvider = ({ children }: { children: ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <AddMealSheetContext.Provider
      value={{
        open,
        openAddMeal: () => setOpen(true),
        closeAddMeal: () => setOpen(false),
      }}
    >
      {children}
    </AddMealSheetContext.Provider>
  );
};

export const useAddMealSheet = () => {
  const ctx = useContext(AddMealSheetContext);
  if (!ctx) {
    throw new Error('useAddMealSheet must be used within AddMealSheetProvider');
  }
  return ctx;
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. This file has no consumers yet (added in later tasks), so there is nothing to click through until Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/contexts/AddMealSheetContext.tsx
git commit -m "feat: add AddMealSheetContext for sheet open/close state

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Extend `DailyMeal` and `SavedMeal` with micronutrient fields

**Files:**
- Modify: `src/hooks/useDailyMeals.ts:6-17`
- Modify: `src/hooks/useSavedMeals.ts:6-16`

**Interfaces:**
- Produces: `DailyMeal` and `SavedMeal` now both carry the 9 optional micronutrient fields (`vitamin_c?`, `vitamin_d?`, `vitamin_b12?`, `iron?`, `calcium?`, `potassium?`, `sodium?`, `magnesium?`, `zinc?`, all `number`), matching columns that already exist on the `daily_meals` and `saved_meals` tables. Task 4's chip-mapping helpers (`rowToItem`, `savedMealToItem`) read these fields.

- [ ] **Step 1: Extend `DailyMeal`**

In `src/hooks/useDailyMeals.ts`, replace:

```ts
export interface DailyMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  meal_time: string;
  logged_date: string;
  logged_at: string;
}
```

with:

```ts
export interface DailyMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_b12?: number;
  iron?: number;
  calcium?: number;
  potassium?: number;
  sodium?: number;
  magnesium?: number;
  zinc?: number;
  meal_time: string;
  logged_date: string;
  logged_at: string;
}
```

- [ ] **Step 2: Extend `SavedMeal`**

In `src/hooks/useSavedMeals.ts`, replace:

```ts
export interface SavedMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  tags: string[];
  notes: string;
}
```

with:

```ts
export interface SavedMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  vitamin_c?: number;
  vitamin_d?: number;
  vitamin_b12?: number;
  iron?: number;
  calcium?: number;
  potassium?: number;
  sodium?: number;
  magnesium?: number;
  zinc?: number;
  tags: string[];
  notes: string;
}
```

No query changes needed in either file — both already `select('*')`, so these columns were already coming back from Supabase, just untyped.

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useDailyMeals.ts src/hooks/useSavedMeals.ts
git commit -m "feat: type the micronutrient columns on DailyMeal and SavedMeal

daily_meals and saved_meals both already have these 9 columns from an
earlier migration; the TS interfaces were never updated to match.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Extract `MealReviewList`, refactor `ChatMealLog` to use it

**Files:**
- Create: `src/components/MealReviewList.tsx`
- Modify: `src/components/ChatMealLog.tsx` (full-file rewrite — see Step 3)

**Interfaces:**
- Consumes: `useAddMealSheet` from Task 1 (`src/contexts/AddMealSheetContext.tsx`).
- Produces: from `MealReviewList.tsx` — the `MealTime`, `ChatMealItem` types, `MEAL_ORDER`, `MEAL_LABEL`, `MICRO`, `fmt` constants/helpers, `chatMealItemToRow(item: ChatMealItem, userId: string, loggedDate: string)` (maps an item to a `daily_meals` insert row), `countMealTimes(items: ChatMealItem[]): number`, and the default-exported `MealReviewList` component with props `{ items: ChatMealItem[]; onAccept: () => void; onBack: () => void; backLabel: string; saving: boolean; banner?: { text: string; options: string[]; onSelect: (option: string) => void } }`. Task 4 (`DescribeMealLog`) imports all of these.

- [ ] **Step 1: Create `MealReviewList.tsx`**

```tsx
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export type MealTime = 'breakfast' | 'lunch' | 'snack' | 'dinner';

export const MEAL_ORDER: MealTime[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export const MEAL_LABEL: Record<MealTime, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

export interface ChatMealItem {
  name: string;
  mealTime: MealTime;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitaminC: number;
  vitaminD: number;
  vitaminB12: number;
  iron: number;
  calcium: number;
  potassium: number;
  sodium: number;
  magnesium: number;
  zinc: number;
}

export const MICRO = [
  { key: 'vitaminC', label: 'Vit C', unit: 'mg', goal: 90, dot: 'bg-chart-vitc', text: 'text-chart-vitc' },
  { key: 'vitaminD', label: 'Vit D', unit: 'µg', goal: 15, dot: 'bg-chart-vitd', text: 'text-chart-vitd' },
  { key: 'vitaminB12', label: 'B12', unit: 'µg', goal: 2.4, dot: 'bg-chart-b12', text: 'text-chart-b12' },
  { key: 'iron', label: 'Iron', unit: 'mg', goal: 18, dot: 'bg-chart-iron', text: 'text-chart-iron' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', goal: 1000, dot: 'bg-chart-calcium', text: 'text-chart-calcium' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', goal: 3500, dot: 'bg-chart-potassium', text: 'text-chart-potassium' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', goal: 2300, cap: true, dot: 'bg-chart-sodium', text: 'text-chart-sodium' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', goal: 400, dot: 'bg-chart-magnesium', text: 'text-chart-magnesium' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', goal: 11, dot: 'bg-chart-zinc', text: 'text-chart-zinc' },
] as const satisfies readonly { key: keyof ChatMealItem; label: string; unit: string; goal: number; cap?: boolean; dot: string; text: string }[];

export const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : Math.round(n * 10) / 10);

export const chatMealItemToRow = (item: ChatMealItem, userId: string, loggedDate: string) => ({
  user_id: userId,
  name: item.name,
  calories: item.calories,
  protein: item.protein,
  carbs: item.carbs,
  fat: item.fat,
  fiber: item.fiber,
  vitamin_c: item.vitaminC,
  vitamin_d: item.vitaminD,
  vitamin_b12: item.vitaminB12,
  iron: item.iron,
  calcium: item.calcium,
  potassium: item.potassium,
  sodium: item.sodium,
  magnesium: item.magnesium,
  zinc: item.zinc,
  meal_time: item.mealTime,
  logged_date: loggedDate,
});

export const countMealTimes = (items: ChatMealItem[]) => new Set(items.map((it) => it.mealTime)).size;

export interface MealReviewListProps {
  items: ChatMealItem[];
  onAccept: () => void;
  onBack: () => void;
  backLabel: string;
  saving: boolean;
  banner?: { text: string; options: string[]; onSelect: (option: string) => void };
}

const MealReviewList = ({ items, onAccept, onBack, backLabel, saving, banner }: MealReviewListProps) => {
  const [openMicros, setOpenMicros] = useState<Record<number, boolean>>({});
  const toggleMicros = (idx: number) => setOpenMicros((p) => ({ ...p, [idx]: !p[idx] }));

  const grouped = MEAL_ORDER.map((mt) => ({
    mealTime: mt,
    items: items.map((it, idx) => ({ ...it, idx })).filter((it) => it.mealTime === mt),
  })).filter((g) => g.items.length > 0);

  const dayTotals = items.reduce(
    (acc, it) => {
      acc.calories += it.calories;
      acc.protein += it.protein;
      acc.carbs += it.carbs;
      acc.fat += it.fat;
      acc.fiber += it.fiber;
      MICRO.forEach((m) => {
        acc.micro[m.key] = (acc.micro[m.key] || 0) + (it[m.key] as number);
      });
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micro: {} as Record<string, number> }
  );

  return (
    <div className="elevation-card space-y-4 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">Review before logging</h2>
        <span className="text-[11px] text-muted-foreground">
          {grouped.length} meal-time{grouped.length === 1 ? '' : 's'} · {items.length} item{items.length === 1 ? '' : 's'}
        </span>
      </div>

      {banner && (
        <div className="space-y-2 rounded-xl border border-chart-carbs/30 bg-chart-carbs/10 p-3.5">
          <p className="text-sm text-foreground">{banner.text}</p>
          <div className="flex flex-wrap gap-1.5">
            {banner.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => banner.onSelect(opt)}
                className="rounded-full border border-chart-carbs/40 bg-chart-carbs/15 px-3 py-1 text-xs font-semibold text-chart-carbs"
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      {grouped.map((g) => {
        const mealTotalCal = g.items.reduce((s, it) => s + it.calories, 0);
        return (
          <div key={g.mealTime} className="overflow-hidden rounded-xl border border-border">
            <div className="flex items-baseline justify-between bg-muted/50 px-3.5 py-2.5">
              <span className="text-sm font-semibold text-foreground">{MEAL_LABEL[g.mealTime]}</span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{Math.round(mealTotalCal)} kcal</span>
            </div>
            <div className="divide-y divide-border/60">
              {g.items.map((it) => (
                <div key={it.idx} className="space-y-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{it.name}</p>
                      {it.grams > 0 && <p className="text-[11px] text-muted-foreground">{it.grams} g</p>}
                    </div>
                    <span className="font-mono text-sm font-medium tabular-nums text-foreground">{Math.round(it.calories)} kcal</span>
                  </div>
                  <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    P {fmt(it.protein)} · C {fmt(it.carbs)} · F {fmt(it.fat)} · Fib {fmt(it.fiber)}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleMicros(it.idx)}
                    className="flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                  >
                    <span>Micronutrients</span>
                    <span className="h-px flex-1 bg-border" />
                    {openMicros[it.idx] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {openMicros[it.idx] && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {MICRO.map((m) => (
                        <div
                          key={m.key}
                          className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5"
                        >
                          <div className="flex items-center gap-1">
                            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                            <span className="text-[9px] text-muted-foreground">{m.label}</span>
                          </div>
                          <span className="font-mono text-[10px] tabular-nums text-foreground">
                            {fmt(it[m.key] as number)} {m.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="elevation-card space-y-2 p-3.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Day totals</span>
          <span className="font-mono text-lg font-bold tabular-nums text-foreground">{Math.round(dayTotals.calories)} kcal</span>
        </div>
        <div className="grid grid-cols-4 gap-2 border-b border-border pb-3">
          {[
            { label: 'Protein', value: dayTotals.protein, dot: 'bg-chart-protein' },
            { label: 'Carbs', value: dayTotals.carbs, dot: 'bg-chart-carbs' },
            { label: 'Fat', value: dayTotals.fat, dot: 'bg-chart-fat' },
            { label: 'Fiber', value: dayTotals.fiber, dot: 'bg-chart-fiber' },
          ].map((row) => (
            <div key={row.label} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} />
                <span className="text-[10px] text-muted-foreground">{row.label}</span>
              </div>
              <span className="font-mono text-xs tabular-nums text-foreground">{fmt(row.value)}g</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {MICRO.map((m) => {
            const v = dayTotals.micro[m.key] || 0;
            const pct = Math.round((v / m.goal) * 100);
            return (
              <div key={m.key} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 flex-none rounded-full ${m.dot}`} />
                <span className="flex-1 truncate text-[10px] text-muted-foreground">{m.label}</span>
                <span className={`font-mono text-[10px] tabular-nums ${m.text}`}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 pt-1">
        <Button onClick={onAccept} disabled={saving} className="h-12 w-full gap-2 rounded-xl">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Logging...' : `Accept & log ${items.length} item${items.length === 1 ? '' : 's'} across ${grouped.length} meal-time${grouped.length === 1 ? '' : 's'}`}
        </Button>
        <Button variant="outline" onClick={onBack} className="h-11 w-full rounded-xl text-sm">
          {backLabel}
        </Button>
      </div>
    </div>
  );
};

export default MealReviewList;
```

- [ ] **Step 2: Verify it compiles standalone**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Rewrite `ChatMealLog.tsx` to use `MealReviewList`**

Replace the full contents of `src/components/ChatMealLog.tsx` with:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import MealReviewList, {
  ChatMealItem,
  MealTime,
  MEAL_ORDER,
  MEAL_LABEL,
  chatMealItemToRow,
  countMealTimes,
} from './MealReviewList';

interface ChatMsg {
  id: string;
  who: 'bot' | 'user' | 'q';
  text: string;
  replies?: string[];
}

const GREETING = 'Tell me what you ate -- any meals, any order. I keep a tally and you tell me when you\'re done.';

const uid = () => Math.random().toString(36).slice(2, 10);

interface ChatMealLogProps {
  defaultMealTime: MealTime;
}

const ChatMealLog = ({ defaultMealTime }: ChatMealLogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { closeAddMeal } = useAddMealSheet();

  const [messages, setMessages] = useState<ChatMsg[]>([{ id: 'm0', who: 'bot', text: GREETING }]);
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [screen, setScreen] = useState<'chat' | 'review'>('chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMsg[] = [...messages, { id: uid(), who: 'user', text: trimmed }];
    setMessages(nextMessages);
    setDraft('');

    if ((trimmed.toLowerCase() === 'done' || trimmed.toLowerCase() === 'finish') && items.length > 0) {
      setScreen('review');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-meal', {
        body: {
          messages: nextMessages.map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
          defaultMealTime,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      setMessages((prev) => [
        ...prev,
        hasOptions
          ? { id: uid(), who: 'q', text: data.reply, replies: data.replyOptions }
          : { id: uid(), who: 'bot', text: data.reply },
      ]);
      if (Array.isArray(data.items)) setItems(data.items);
    } catch (err) {
      console.error('chat-meal error:', err);
      setMessages((prev) => [
        ...prev,
        { id: uid(), who: 'bot', text: 'Could not process that. Try rephrasing, or add it manually instead.' },
      ]);
    } finally {
      setSending(false);
    }
  };

  const dayCalories = Math.round(items.reduce((s, it) => s + it.calories, 0));
  const groupedForTally = MEAL_ORDER.map((mt) => ({
    mealTime: mt,
    calories: items.filter((it) => it.mealTime === mt).reduce((s, it) => s + it.calories, 0),
  })).filter((g) => g.calories > 0);

  const handleAccept = async () => {
    if (!user || items.length === 0) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = items.map((it) => chatMealItemToRow(it, user.id, today));

      const { error } = await supabase.from('daily_meals').insert(rows);
      if (error) throw error;

      const mealTimeCount = countMealTimes(items);
      toast({
        title: 'Logged',
        description: `${items.length} item${items.length === 1 ? '' : 's'} across ${mealTimeCount} meal-time${mealTimeCount === 1 ? '' : 's'} added to today.`,
      });
      closeAddMeal();
    } catch (err) {
      console.error('Error logging chat meals:', err);
      toast({ title: 'Error', description: 'Failed to log meals. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (screen === 'review') {
    return (
      <MealReviewList
        items={items}
        onAccept={handleAccept}
        onBack={() => setScreen('chat')}
        backLabel="Something's off -- keep chatting"
        saving={saving}
      />
    );
  }

  return (
    <div className="elevation-card flex flex-col gap-3 p-4">
      <div ref={scrollRef} className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.who === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-2">
              <div
                className={
                  m.who === 'user'
                    ? 'rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground'
                    : m.who === 'q'
                      ? 'rounded-2xl rounded-tl-sm border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm text-foreground'
                      : 'rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground'
                }
              >
                {m.text}
              </div>
              {m.who === 'q' && m.replies && (
                <div className="flex flex-wrap gap-1.5">
                  {m.replies.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => send(r)}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5"
          >
            <span className="text-xs font-semibold text-foreground">
              Running tally · {dayCalories} kcal
            </span>
            {summaryOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {summaryOpen && (
            <div className="space-y-1.5 border-t border-border px-3.5 py-2.5">
              {groupedForTally.map((g) => (
                <div key={g.mealTime} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{MEAL_LABEL[g.mealTime]}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {Math.round(g.calories)} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 2 chapati and dal for dinner"
          disabled={sending}
          className="h-11 flex-1 rounded-xl border border-border bg-background/50 px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()} className="h-11 w-11 flex-none rounded-xl">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {items.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setScreen('review')}
          className="h-10 w-full rounded-xl text-sm"
        >
          Finish -- review {items.length} item{items.length === 1 ? '' : 's'}
        </Button>
      )}
    </div>
  );
};

export default ChatMealLog;
```

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors. (`useAddMealSheet` has no provider mounted yet, so this won't be functionally clickable until Task 6 — that's expected at this point in the plan.)

- [ ] **Step 5: Commit**

```bash
git add src/components/MealReviewList.tsx src/components/ChatMealLog.tsx
git commit -m "feat: extract MealReviewList from ChatMealLog for reuse

Pulls the review-screen UI, ChatMealItem/MealTime types, and the
insert-row mapping out of ChatMealLog so DescribeMealLog (next) can
share the same editable review screen instead of duplicating it.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `DescribeMealLog` — single-shot describe-and-review flow

**Files:**
- Create: `src/components/DescribeMealLog.tsx`

**Interfaces:**
- Consumes: `useAddMealSheet` (Task 1); `ChatMealItem`, `MealTime`, `chatMealItemToRow`, `countMealTimes`, and the default-exported `MealReviewList` (Task 3); `DailyMeal` (Task 2, `src/hooks/useDailyMeals.ts`); `useSavedMeals`, `SavedMeal` (Task 2, `src/hooks/useSavedMeals.ts`); the `chat-meal` edge function via `supabase.functions.invoke('chat-meal', { body: { messages, defaultMealTime } })`, which returns `{ reply: string; replyOptions: string[]; items: ChatMealItem[] }` or `{ error: string }`.
- Produces: default-exported `DescribeMealLog` component with props `{ defaultMealTime: MealTime }` — same prop shape as `ChatMealLog`, so `AddMeal.tsx` (Task 5) can mount both identically.

- [ ] **Step 1: Create `DescribeMealLog.tsx`**

```tsx
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { useSavedMeals, type SavedMeal } from '@/hooks/useSavedMeals';
import type { DailyMeal } from '@/hooks/useDailyMeals';
import MealReviewList, {
  ChatMealItem,
  MealTime,
  chatMealItemToRow,
  countMealTimes,
} from './MealReviewList';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface DescribeMealLogProps {
  defaultMealTime: MealTime;
}

const rowToItem = (row: DailyMeal): ChatMealItem => ({
  name: row.name,
  mealTime: row.meal_time as MealTime,
  grams: 0,
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

const DescribeMealLog = ({ defaultMealTime }: DescribeMealLogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { closeAddMeal } = useAddMealSheet();
  const { meals: savedMeals } = useSavedMeals();

  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [screen, setScreen] = useState<'compose' | 'review'>('compose');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chipLoading, setChipLoading] = useState<'yesterday' | 'dinner' | 'most' | null>(null);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [banner, setBanner] = useState<{ text: string; options: string[] } | null>(null);

  const callChatMeal = async (nextHistory: ChatTurn[]) => {
    const { data, error } = await supabase.functions.invoke('chat-meal', {
      body: { messages: nextHistory, defaultMealTime },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { reply: string; replyOptions: string[]; items: ChatMealItem[] };
  };

  const handleBreakItDown = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const nextHistory: ChatTurn[] = [{ role: 'user', content: trimmed }];
    try {
      const data = await callChatMeal(nextHistory);
      setHistory([...nextHistory, { role: 'assistant', content: data.reply || '' }]);
      setItems(Array.isArray(data.items) ? data.items : []);
      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      setBanner(hasOptions ? { text: data.reply, options: data.replyOptions } : null);
      setScreen('review');
    } catch (err) {
      console.error('chat-meal error:', err);
      toast({
        title: 'Error',
        description: 'Could not process that. Try rephrasing, or add it manually instead.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleBannerOption = async (option: string) => {
    setSending(true);
    const nextHistory: ChatTurn[] = [...history, { role: 'user', content: option }];
    try {
      const data = await callChatMeal(nextHistory);
      setHistory([...nextHistory, { role: 'assistant', content: data.reply || '' }]);
      setItems(Array.isArray(data.items) ? data.items : []);
      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      setBanner(hasOptions ? { text: data.reply, options: data.replyOptions } : null);
    } catch (err) {
      console.error('chat-meal error:', err);
      toast({ title: 'Error', description: 'Could not process that.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSameAsYesterday = async () => {
    if (!user) return;
    setChipLoading('yesterday');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_date', dateStr);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'Nothing found', description: 'No meals logged yesterday.' });
        return;
      }
      setBanner(null);
      setItems((data as DailyMeal[]).map(rowToItem));
      setScreen('review');
    } catch (err) {
      console.error("Failed to load yesterday's meals:", err);
      toast({ title: 'Error', description: "Failed to load yesterday's meals", variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handleRepeatLastDinner = async () => {
    if (!user) return;
    setChipLoading('dinner');
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('meal_time', 'dinner')
        .lt('logged_date', today)
        .order('logged_date', { ascending: false })
        .order('logged_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'Nothing found', description: 'No past dinners logged yet.' });
        return;
      }
      const lastDate = (data as DailyMeal[])[0].logged_date;
      const rows = (data as DailyMeal[]).filter((r) => r.logged_date === lastDate);
      setBanner(null);
      setItems(rows.map((r) => ({ ...rowToItem(r), mealTime: defaultMealTime })));
      setScreen('review');
    } catch (err) {
      console.error('Failed to load last dinner:', err);
      toast({ title: 'Error', description: 'Failed to load last dinner', variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handleMostLogged = async () => {
    if (!user) return;
    setChipLoading('most');
    try {
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data as DailyMeal[] | null;
      if (!rows || rows.length === 0) {
        toast({ title: 'Nothing found', description: 'No meal history yet.' });
        return;
      }
      const counts = new Map<string, number>();
      rows.forEach((r) => counts.set(r.name, (counts.get(r.name) || 0) + 1));
      let topName = rows[0].name;
      let topCount = 0;
      counts.forEach((count, name) => {
        if (count > topCount) {
          topCount = count;
          topName = name;
        }
      });
      const mostRecent = rows.find((r) => r.name === topName)!;
      setBanner(null);
      setItems([{ ...rowToItem(mostRecent), mealTime: defaultMealTime }]);
      setScreen('review');
    } catch (err) {
      console.error('Failed to load most logged meal:', err);
      toast({ title: 'Error', description: 'Failed to load most logged meal', variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handlePickSavedMeal = (meal: SavedMeal) => {
    setBanner(null);
    setItems([savedMealToItem(meal, defaultMealTime)]);
    setScreen('review');
  };

  const handleAccept = async () => {
    if (!user || items.length === 0) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = items.map((it) => chatMealItemToRow(it, user.id, today));

      const { error } = await supabase.from('daily_meals').insert(rows);
      if (error) throw error;

      const mealTimeCount = countMealTimes(items);
      toast({
        title: 'Logged',
        description: `${items.length} item${items.length === 1 ? '' : 's'} across ${mealTimeCount} meal-time${mealTimeCount === 1 ? '' : 's'} added to today.`,
      });
      closeAddMeal();
    } catch (err) {
      console.error('Error logging described meals:', err);
      toast({ title: 'Error', description: 'Failed to log meals. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (screen === 'review') {
    return (
      <MealReviewList
        items={items}
        onAccept={handleAccept}
        onBack={() => {
          setScreen('compose');
          setBanner(null);
        }}
        backLabel="Edit description"
        saving={saving}
        banner={banner ? { text: banner.text, options: banner.options, onSelect: handleBannerOption } : undefined}
      />
    );
  }

  return (
    <div className="elevation-card flex flex-col gap-4 p-4">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. grilled chicken sandwich, a banana and a black coffee for lunch"
        disabled={sending}
        rows={4}
        className="w-full resize-none rounded-xl border border-border bg-background/50 p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Or start from</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSameAsYesterday}
            disabled={chipLoading !== null}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {chipLoading === 'yesterday' ? 'Loading...' : 'Same as yesterday'}
          </button>
          <button
            type="button"
            onClick={handleRepeatLastDinner}
            disabled={chipLoading !== null}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {chipLoading === 'dinner' ? 'Loading...' : 'Repeat last dinner'}
          </button>
          <button
            type="button"
            onClick={() => setShowSavedMeals((v) => !v)}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground"
          >
            From saved meals
          </button>
          <button
            type="button"
            onClick={handleMostLogged}
            disabled={chipLoading !== null}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {chipLoading === 'most' ? 'Loading...' : 'Most logged'}
          </button>
        </div>
        {showSavedMeals && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {savedMeals.length === 0 && <p className="p-2 text-xs text-muted-foreground">No saved meals yet.</p>}
            {savedMeals.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => handlePickSavedMeal(meal)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"
              >
                <span>{meal.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{Math.round(meal.calories)} kcal</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        onClick={handleBreakItDown}
        disabled={sending || !draft.trim()}
        className="h-12 w-full gap-2 rounded-xl"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {sending ? 'Breaking it down...' : 'Break it down'}
      </Button>
    </div>
  );
};

export default DescribeMealLog;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DescribeMealLog.tsx
git commit -m "feat: add DescribeMealLog single-shot describe-and-review flow

Reuses the existing chat-meal edge function for one-shot parsing and
MealReviewList for the review screen. Adds 4 starter chips backed by
existing daily_meals/saved_meals data -- no new backend.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `AddMeal.tsx` — drop page chrome, add Describe tab, rename Chat

**Files:**
- Modify: `src/pages/AddMeal.tsx`

**Interfaces:**
- Consumes: `useAddMealSheet` (Task 1); `DescribeMealLog` (Task 4); `ChatMealLog` (Task 3, prop shape unchanged: `{ defaultMealTime: MealTime }`).

- [ ] **Step 1: Drop the page-chrome imports**

In `src/pages/AddMeal.tsx`, remove `ChevronLeft` from the `lucide-react` import (line 15-26 block) — it becomes:

```tsx
import {
  Search,
  Edit3,
  ScanBarcode,
  Sparkles,
  Loader2,
  Plus,
  Clock,
  Trash2,
  CheckCircle,
  Flame
} from 'lucide-react';
```

Replace line 27:

```tsx
import { Link, useNavigate } from 'react-router-dom';
```

with nothing (delete the line — `Link` and `useNavigate` are no longer used anywhere in this file after Step 3 below).

Add, alongside the other `@/components/...` imports near line 47:

```tsx
import ChatMealLog from '@/components/ChatMealLog';
import DescribeMealLog from '@/components/DescribeMealLog';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
```

(the `ChatMealLog` import already exists at line 47 — just add the two new lines after it.)

- [ ] **Step 2: Swap `useNavigate` for `useAddMealSheet`**

Replace:

```tsx
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
```

with:

```tsx
  const { toast } = useToast();
  const { user } = useAuth();
  const { closeAddMeal } = useAddMealSheet();
```

- [ ] **Step 3: Replace the Manual tab's `navigate('/')` with `closeAddMeal()`**

In the Manual-tab submit handler (around line 546), replace:

```tsx
      navigate('/');
```

with:

```tsx
      closeAddMeal();
```

- [ ] **Step 4: Drop the header, simplify the outer wrapper**

Replace:

```tsx
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-card border border-border text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-display font-semibold text-foreground flex-1">Add meal</h1>
        </div>

        {/* Meal slot chips */}
        <div className="flex gap-2 mb-6">
```

with:

```tsx
  return (
    <div className="px-4 pb-6 pt-2">
      {/* Meal slot chips */}
      <div className="flex gap-2 mb-6">
```

- [ ] **Step 5: Close the simplified wrapper**

Replace:

```tsx
          </TabsContent>
        </Tabs>
      </div>
      
      <BarcodeScanner 
```

with:

```tsx
          </TabsContent>
        </Tabs>

      <BarcodeScanner 
```

And replace the file's closing:

```tsx
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddMeal;
```

with:

```tsx
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddMeal;
```

(unchanged — the outer `<div>` that opened at `<div className="px-4 pb-6 pt-2">` in Step 4 is the one this closes; no further edit needed here, listed for confirmation only.)

- [ ] **Step 6: Expand the tab strip to 5 tabs**

Replace:

```tsx
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="search" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Search className="w-3.5 h-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="indian" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 text-chart-carbs" />
              Indian
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              AI Log
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Edit3 className="w-3.5 h-3.5" />
              Manual
            </TabsTrigger>
          </TabsList>
```

with:

```tsx
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="search" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Search className="w-3.5 h-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="indian" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 text-chart-carbs" />
              Indian
            </TabsTrigger>
            <TabsTrigger value="describe" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Describe
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Edit3 className="w-3.5 h-3.5" />
              Manual
            </TabsTrigger>
          </TabsList>
```

- [ ] **Step 7: Replace the "ai" tab content with "describe" + "chat"**

Replace:

```tsx
          <TabsContent value="ai">
            <ChatMealLog defaultMealTime={mealData.mealTime} />
          </TabsContent>
```

with:

```tsx
          <TabsContent value="describe">
            <DescribeMealLog defaultMealTime={mealData.mealTime} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatMealLog defaultMealTime={mealData.mealTime} />
          </TabsContent>
```

- [ ] **Step 8: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors, and no "declared but never used" warnings for `Link`, `useNavigate`, or `ChevronLeft` (all removed in Step 1).

- [ ] **Step 9: Commit**

```bash
git add src/pages/AddMeal.tsx
git commit -m "feat: AddMeal drops page chrome, adds Describe tab, renames AI Log to Chat

Prepares AddMeal to be mounted as sheet content instead of a routed
page: no more back-chevron/header, and navigate('/') on successful
manual-add is replaced with closeAddMeal().

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Wire the sheet — `App.tsx`, `AppLayout.tsx`, `BottomNav.tsx`, `EmptyMealsState.tsx`, hardware back button

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/AppLayout.tsx`
- Modify: `src/components/BottomNav.tsx` (full-file rewrite — see Step 3)
- Modify: `src/components/EmptyMealsState.tsx` (full-file rewrite — see Step 4)
- Modify: `src/hooks/useNativeApp.ts` (full-file rewrite — see Step 5)

**Interfaces:**
- Consumes: `AddMealSheetProvider`, `useAddMealSheet` (Task 1); `AddMeal` default export (Task 5); the shadcn `Drawer`/`DrawerContent` from `src/components/ui/drawer.tsx` (pre-existing, `vaul`-backed).

- [ ] **Step 1: `App.tsx` — provide the context, drop the `/add-meal` route**

Replace:

```tsx
import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AuthLanding from './components/AuthLanding';
import AppLayout from './components/AppLayout';
import { useNativeApp } from './hooks/useNativeApp';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const AddMeal = lazy(() => import('./pages/AddMeal'));
const SavedMeals = lazy(() => import('./pages/SavedMeals'));
const History = lazy(() => import('./pages/History'));
const Steps = lazy(() => import('./pages/Steps'));
const Profile = lazy(() => import('./pages/Profile'));
```

with:

```tsx
import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AddMealSheetProvider } from './contexts/AddMealSheetContext';
import AuthLanding from './components/AuthLanding';
import AppLayout from './components/AppLayout';
import { useNativeApp } from './hooks/useNativeApp';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const SavedMeals = lazy(() => import('./pages/SavedMeals'));
const History = lazy(() => import('./pages/History'));
const Steps = lazy(() => import('./pages/Steps'));
const Profile = lazy(() => import('./pages/Profile'));
```

Replace:

```tsx
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/add-meal" element={<AddMeal />} />
          <Route path="/saved-meals" element={<SavedMeals />} />
          <Route path="/history" element={<History />} />
          <Route path="/steps" element={<Steps />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
```

with:

```tsx
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/saved-meals" element={<SavedMeals />} />
          <Route path="/history" element={<History />} />
          <Route path="/steps" element={<Steps />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
```

Replace:

```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
```

with:

```tsx
const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
        <AuthProvider>
          <AddMealSheetProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AddMealSheetProvider>
        </AuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);
```

`AddMealSheetProvider` must wrap `AppRoutes` (not be placed deeper, e.g. only inside `AppLayout`) because `useNativeApp()` is called directly inside `AppRoutes` (Step 5 below has it call `useAddMealSheet()`), so it needs to be a context descendant of the provider.

- [ ] **Step 2: `AppLayout.tsx` — host the `Drawer`**

Replace the full contents of `src/components/AppLayout.tsx` with:

```tsx
import { lazy, Suspense, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu } from 'lucide-react';
import AppDrawer from './AppDrawer';
import BottomNav from './BottomNav';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const AddMeal = lazy(() => import('../pages/AddMeal'));

const AppLayout = () => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { open: addMealOpen, closeAddMeal } = useAddMealSheet();

  return (
    <div
      className="min-h-screen w-full bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <AppDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <main className="mx-auto w-full max-w-[560px] px-4 pb-28 pt-4">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        </div>

        <Outlet />
      </main>

      <BottomNav />

      <Drawer open={addMealOpen} onOpenChange={(next) => { if (!next) closeAddMeal(); }}>
        <DrawerContent className="max-h-[92vh]">
          <div className="overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
            <Suspense
              fallback={
                <div className="flex justify-center py-16">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-primary" />
                </div>
              }
            >
              <AddMeal />
            </Suspense>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default AppLayout;
```

- [ ] **Step 3: `BottomNav.tsx` — open the sheet instead of navigating**

Replace the full contents of `src/components/BottomNav.tsx` with:

```tsx
import { Link, useLocation } from 'react-router-dom';
import { Home, Search, Plus, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const tabs = [{ path: '/', icon: Home, label: 'Today' }] as const;

const trailingTabs = [
  { path: '/history', icon: Calendar, label: 'History' },
  { path: '/profile', icon: User, label: 'You' },
] as const;

const BottomNav = () => {
  const location = useLocation();
  const { openAddMeal } = useAddMealSheet();

  const renderTab = ({
    path,
    icon: Icon,
    label,
  }: (typeof tabs)[number] | (typeof trailingTabs)[number]) => {
    const isActive = location.pathname === path;
    return (
      <Link
        key={path}
        to={path}
        className="flex flex-1 flex-col items-center justify-center gap-1 min-h-12"
      >
        <Icon
          className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')}
        />
        <span
          className={cn(
            'text-[10px] leading-none',
            isActive ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="elevation-glass fixed left-3 right-3 z-40 flex items-center justify-between rounded-[20px] px-1.5 py-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {tabs.map(renderTab)}
      <button
        type="button"
        onClick={openAddMeal}
        className="flex flex-1 flex-col items-center justify-center gap-1 min-h-12"
      >
        <Search className="w-5 h-5 text-muted-foreground" />
        <span className="text-[10px] leading-none font-medium text-muted-foreground">Add</span>
      </button>
      <div className="flex flex-1 justify-center">
        <button
          onClick={openAddMeal}
          aria-label="Add meal"
          className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-primary shadow-[0_10px_24px_-8px_hsl(var(--primary)/0.95)]"
        >
          <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.4} />
        </button>
      </div>
      {trailingTabs.map(renderTab)}
    </nav>
  );
};

export default BottomNav;
```

- [ ] **Step 4: `EmptyMealsState.tsx` — open the sheet instead of a `Link`**

Replace the full contents of `src/components/EmptyMealsState.tsx` with:

```tsx
import React from 'react';
import { Plus, Utensils } from 'lucide-react';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const EmptyMealsState = () => {
  const { openAddMeal } = useAddMealSheet();

  return (
    <div className="elevation-card flex flex-col items-center gap-3 px-4 py-8 text-center sm:py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground sm:h-16 sm:w-16">
        <Utensils className="h-6 w-6 sm:h-8 sm:w-8" />
      </div>
      <p className="font-sans text-sm text-muted-foreground sm:text-base">
        No meals logged today yet.
      </p>
      <button
        type="button"
        onClick={openAddMeal}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-sans text-sm font-semibold text-primary-foreground sm:w-auto"
      >
        <Plus className="h-4 w-4" />
        Add Your First Meal
      </button>
    </div>
  );
};

export default EmptyMealsState;
```

- [ ] **Step 5: `useNativeApp.ts` — hardware back button closes the sheet first**

Replace the full contents of `src/hooks/useNativeApp.ts` with:

```ts
import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';
import { Capacitor } from '@capacitor/core';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

export const useNativeApp = () => {
  const { open, closeAddMeal } = useAddMealSheet();
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initNativeHooks = async () => {
      // 1. Let Android reserve space for the status bar instead of drawing over the webview
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch (err) {
        console.error('StatusBar plugin error:', err);
      }

      // 2. Hardware Back Button Routing -- close the Add Meal sheet first if it's open
      CapacitorApp.addListener('backButton', ({ canGoBack }) => {
        if (openRef.current) {
          closeAddMeal();
          return;
        }
        if (window.history.state && window.history.state.idx > 0) {
          window.history.back();
        } else {
          CapacitorApp.exitApp();
        }
      });

      // 3. Prevent layout shifting behind keyboard by allocating padding
      Keyboard.addListener('keyboardWillShow', (info) => {
        document.body.style.paddingBottom = `${info.keyboardHeight}px`;
      });

      Keyboard.addListener('keyboardWillHide', () => {
        document.body.style.paddingBottom = '0px';
      });
    };

    initNativeHooks();

    return () => {
      // Cleanup listeners
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.removeAllListeners();
        Keyboard.removeAllListeners();
      }
    };
  }, []);
};
```

The `backButton` listener is registered once (empty dependency array, matching the original) so it can't see later renders' `open` value directly — `openRef` is kept current via the separate effect above and read inside the listener instead, avoiding a stale closure.

- [ ] **Step 6: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors, no unused-import warnings.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/AppLayout.tsx src/components/BottomNav.tsx src/components/EmptyMealsState.tsx src/hooks/useNativeApp.ts
git commit -m "feat: wire Add Meal as a swipeable sheet, drop /add-meal route

BottomNav's Add tab/FAB and EmptyMealsState now open the sheet via
AddMealSheetContext instead of navigating. Android hardware back
button closes the sheet before falling back to route history/exit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck and build**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 2: Start the dev server and open it in the Browser tool**

Use `preview_start` with the project's dev server configuration, then `navigate` to the app's root and sign in if needed.

- [ ] **Step 3: Verify all three entry points open the sheet**

From Today (`/`): tap the "Add" tab in the bottom nav — sheet opens. Swipe it down (or tap the overlay) — it closes and Today is still there underneath. Tap the raised "+" FAB — sheet opens again, close it the same way. Delete all of today's logged meals (or use a day with none) so `EmptyMealsState` renders, tap "Add Your First Meal" — sheet opens.

- [ ] **Step 4: Verify Describe end-to-end**

Open the sheet, select the "Describe" tab. Type a multi-item sentence (e.g. "2 idlis and peanut chutney for breakfast, then dal and rice for lunch"), tap "Break it down". Confirm the review screen shows items grouped correctly under Breakfast and Lunch with correct macros, and the micronutrient chips expand correctly. Tap "Edit description" and confirm it returns to the compose screen. Re-submit and tap "Accept & log ..." — confirm a success toast appears and the sheet closes, then check the Dashboard shows the new items under the right meal-times.

- [ ] **Step 5: Verify all 4 starter chips**

Re-open the sheet → Describe. Tap "Same as yesterday" (expect either a populated review screen if you logged something yesterday, or a "Nothing found" toast). Tap "Repeat last dinner" the same way. Tap "From saved meals" — confirm the inline list appears (or "No saved meals yet." if empty) and tapping an entry goes straight to review. Tap "Most logged" the same way.

- [ ] **Step 6: Verify the amber banner path**

In Describe, type something genuinely ambiguous that would make `chat-meal` ask a clarifying question (e.g. a vague portion like "some rice and dal"). Confirm the review screen shows the amber banner with quick-reply chips, and tapping one resolves it and refreshes the items without leaving the review screen.

- [ ] **Step 7: Verify Search, Indian, Chat, Manual are unaffected**

Inside the sheet, click through all four remaining tabs and confirm each behaves exactly as before (search results selectable, Indian dish browsing/custom foods, Chat's multi-turn flow reaching its own review screen via `MealReviewList`, Manual form submit closes the sheet via `closeAddMeal()` and shows the Dashboard).

- [ ] **Step 8: Both themes**

Toggle the app's theme (Profile → Appearance) to Light, repeat a quick pass through the sheet (open/close, Describe, review screen, banner) to confirm no dark-only styling leaked in (the amber banner in particular, since it's new). Switch back to Dark.

- [ ] **Step 9: Rebuild the debug APK and check on-device**

```bash
npx cap sync android
```

```bash
cd android && JAVA_HOME="D:/DevTools/AndroidStudio/jbr" ./gradlew assembleDebug
```

With the device connected via `adb devices -l`, install:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Repeat Steps 3-6 on-device, and specifically confirm the Android hardware back button closes the sheet when it's open (rather than exiting the app or navigating away underneath it).

- [ ] **Step 10: Commit if any fixes were needed during verification**

If Steps 1-9 required any code changes to pass, commit them:

```bash
git add -A
git commit -m "fix: address issues found during Add Meal sheet verification

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

If no changes were needed, skip this step — nothing to commit.

---

## Self-Review

**Spec coverage:**
- Navigation: sheet-over-Today, drop `/add-meal` route, all 3 entry points → Task 6.
- Tab strip (Search · Indian · Describe · Chat · Manual) → Task 5.
- `chat-meal` reuse for Describe, no new edge function → Task 4.
- Amber banner (not per-item) → `MealReviewList`'s `banner` prop (Task 3), driven by Task 4.
- `MealReviewList` extraction/reuse → Task 3.
- All 4 starter chips with their exact data sources → Task 4.
- `DailyMeal`/`SavedMeal` interface extension → Task 2.
- `grams > 0` conditional portion line → Task 3 (`MealReviewList`), used by chip-sourced items from Task 4.
- Error handling patterns (toasts matching existing hooks) → Tasks 3, 4.
- Testing/verification list from the spec → Task 7 (Steps 1-9 map 1:1 to the spec's 6 verification points, plus the hardware-back-button check this plan added).

**Placeholder scan:** no TBD/TODO; every step has complete, concrete code; commit messages are the actual messages to use, not descriptions of messages.

**Type consistency:** `ChatMealItem`, `MealTime`, `MEAL_ORDER`, `MEAL_LABEL`, `chatMealItemToRow`, `countMealTimes` are defined once in Task 3 and only ever imported (never redefined) in Tasks 4 and 5. `DescribeMealLog`'s and `ChatMealLog`'s props (`{ defaultMealTime: MealTime }`) match how `AddMeal.tsx` mounts both in Task 5. `useAddMealSheet()`'s return shape (`{ open, openAddMeal, closeAddMeal }`) from Task 1 is used consistently (only the fields each consumer needs) in Tasks 3, 4, 5, and 6.
