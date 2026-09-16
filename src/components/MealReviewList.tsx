import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  grams: item.grams || null,
  unit: 'g',
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
  onChangeMealTime: (idx: number, mealTime: MealTime) => void;
  backLabel: string;
  saving: boolean;
  banner?: { text: string; options: string[]; onSelect: (option: string) => void };
}

const MealReviewList = ({ items, onAccept, onBack, onChangeMealTime, backLabel, saving, banner }: MealReviewListProps) => {
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
                  <div className="flex gap-1.5">
                    {MEAL_ORDER.map((mt) => (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => onChangeMealTime(it.idx, mt)}
                        className={cn(
                          'flex-1 h-7 rounded-full text-[10px] font-medium border transition-colors',
                          it.mealTime === mt
                            ? 'bg-primary/12 border-primary/40 text-primary'
                            : 'bg-muted border-border text-muted-foreground'
                        )}
                      >
                        {MEAL_LABEL[mt]}
                      </button>
                    ))}
                  </div>
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
