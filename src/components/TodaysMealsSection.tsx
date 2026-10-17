import { useEffect, useRef, type ReactNode } from 'react';
import type { DailyMeal } from '@/hooks/useDailyMeals';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { flyToPlate } from '@/lib/flyToPlate';
import AnimatedMealCard from './AnimatedMealCard';

const GROUPS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snack', 'Snacks'],
] as const;

// The token takes the color of whichever macro gives the meal most of its calories.
const toneOf = (m: DailyMeal) => {
  const p = (m.protein || 0) * 4;
  const c = (m.carbs || 0) * 4;
  const f = (m.fat || 0) * 9;
  if (f > p && f > c) return 'hsl(var(--chart-fat))';
  return p > c ? 'hsl(var(--chart-protein))' : 'hsl(var(--chart-carbs))';
};

// A meal logged while Today is open drops into the list and sends a token up into the plate.
const LandingMeal = ({ meal, children }: { meal: DailyMeal; children: ReactNode }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) flyToPlate(ref.current.getBoundingClientRect(), (meal.name.trim()[0] ?? '·').toUpperCase(), toneOf(meal));
    // Once, when the meal first appears; a refetch hands over a new meal object but must not fly it again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="motion-drop rounded-xl">
      {children}
    </div>
  );
};

interface TodaysMealsSectionProps {
  meals: DailyMeal[];
  onEditMeal: (meal: DailyMeal) => void;
  onDeleteMeal: (mealId: string, mealName: string) => void;
}

// Breakfast, lunch and dinner always show, so an empty one is a place to log it; snacks only once there are some.
const TodaysMealsSection = ({ meals, onEditMeal, onDeleteMeal }: TodaysMealsSectionProps) => {
  const { openAddMeal } = useAddMealSheet();
  // Meals already on screen when Today opened don't animate; ones logged since drop in.
  const initial = useRef<Set<string> | null>(null);
  if (initial.current === null) initial.current = new Set(meals.map((m) => m.id));

  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">Today’s meals</h2>
        <Link to="/history" className="text-sm font-semibold text-chart-protein">
          History
        </Link>
      </div>

      {GROUPS.map(([mealTime, label]) => {
        const group = meals.filter((m) => (m.meal_time || 'snack') === mealTime);
        if (group.length === 0) {
          if (mealTime === 'snack') return null;
          return (
            <button
              key={mealTime}
              type="button"
              onClick={() => openAddMeal(mealTime)}
              className="flex min-h-[64px] items-center justify-between rounded-[20px] border-[1.5px] border-dashed border-border px-4 py-3 text-left transition-transform active:scale-[.98]"
            >
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold text-foreground">{label}</span>
                <span className="text-[13px] text-faint">Nothing logged yet</span>
              </span>
              <span className="flex h-10 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-semibold text-chart-protein">
                <Plus className="h-4 w-4" strokeWidth={2.4} />
                Log {label.toLowerCase()}
              </span>
            </button>
          );
        }
        const totalCalories = group.reduce((sum, m) => sum + (m.calories || 0), 0);
        return (
          <div key={mealTime} className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-0.5 text-sm">
              <span className="font-semibold text-foreground">{label}</span>
              <span className="text-muted-foreground">{totalCalories.toLocaleString()} kcal</span>
            </div>
            {group.map((meal) => {
              const card = <AnimatedMealCard meal={meal} onEditMeal={onEditMeal} onDeleteMeal={onDeleteMeal} />;
              return initial.current?.has(meal.id) ? (
                <div key={meal.id}>{card}</div>
              ) : (
                <LandingMeal key={meal.id} meal={meal}>
                  {card}
                </LandingMeal>
              );
            })}
          </div>
        );
      })}
    </section>
  );
};

export default TodaysMealsSection;
