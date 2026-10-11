import type { DailyMeal } from '@/hooks/useDailyMeals';
import { Link } from 'react-router-dom';
import AnimatedMealCard from './AnimatedMealCard';
import EmptyMealsState from './EmptyMealsState';

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

const TodaysMealsSection = ({ meals, onEditMeal, onDeleteMeal }: TodaysMealsSectionProps) => (
  <div className="flex flex-col gap-[11px] animate-fade-in-up" style={{ animationDelay: '200ms' }}>
    <div className="flex items-baseline justify-between">
      <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Today's meals
      </h2>
      <Link to="/history" className="font-sans text-[11px] font-medium text-primary">
        See all
      </Link>
    </div>

    {meals.length === 0 ? (
      <EmptyMealsState />
    ) : (
      <div className="flex flex-col gap-4">
        {GROUPS.map(([mealTime, label]) => {
          const group = meals.filter((m) => (m.meal_time || 'snack') === mealTime);
          if (group.length === 0) return null;
          const knownGrams = group.filter((m) => m.grams != null);
          const totalGrams = knownGrams.reduce((sum, m) => sum + Number(m.grams), 0);
          const totalCalories = group.reduce((sum, m) => sum + (m.calories || 0), 0);
          return (
            <div key={mealTime} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {label}
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {knownGrams.length > 0 && `${Math.round(totalGrams)} g · `}
                  {totalCalories} kcal
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.map((meal) => (
                  <AnimatedMealCard key={meal.id} meal={meal} onEditMeal={onEditMeal} onDeleteMeal={onDeleteMeal} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

export default TodaysMealsSection;
