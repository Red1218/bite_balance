import { useRef } from 'react';
import type { DailyMeal } from '@/hooks/useDailyMeals';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import AnimatedMealCard from './AnimatedMealCard';

const GROUPS = [
  ['breakfast', 'Breakfast'],
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
  ['snack', 'Snacks'],
] as const;

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
            {group.map((meal) => (
              <div key={meal.id} className={initial.current?.has(meal.id) ? undefined : 'motion-drop rounded-xl'}>
                <AnimatedMealCard meal={meal} onEditMeal={onEditMeal} onDeleteMeal={onDeleteMeal} />
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
};

export default TodaysMealsSection;
