import React from 'react';
import { Edit, Trash2 } from 'lucide-react';

interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meal_time: string;
  logged_at: string;
}

interface AnimatedMealCardProps {
  meal: MealItem;
  onEditMeal: (meal: any) => void;
  onDeleteMeal: (mealId: string, mealName: string) => void;
}

// Tint each meal-time's monogram avatar with one of the fixed data-hue tokens.
// Class strings are written out in full (not interpolated) so Tailwind's
// content scanner can see them.
const MEAL_TIME_STYLE: Record<string, string> = {
  breakfast: 'bg-chart-carbs/12 border-chart-carbs/24 text-chart-carbs',
  lunch: 'bg-chart-fiber/12 border-chart-fiber/24 text-chart-fiber',
  dinner: 'bg-chart-fat/12 border-chart-fat/24 text-chart-fat',
  snack: 'bg-chart-steps/12 border-chart-steps/24 text-chart-steps',
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

const AnimatedMealCard = ({ meal, onEditMeal, onDeleteMeal }: AnimatedMealCardProps) => {
  const hueClasses = MEAL_TIME_STYLE[meal.meal_time] || MEAL_TIME_STYLE.snack;

  return (
    <div className="elevation-card flex items-center gap-3 p-[13px]">
      <div
        className={`flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] border font-mono text-xs font-semibold ${hueClasses}`}
      >
        {getInitials(meal.name)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[15px] font-medium leading-tight text-foreground">
          {meal.name}
        </div>
        <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
          P {Math.round(meal.protein || 0)} · C {Math.round(meal.carbs || 0)} · F{' '}
          {Math.round(meal.fat || 0)}
        </div>
      </div>

      <div className="flex-none text-right">
        <div className="font-mono text-[17px] font-semibold tabular-nums text-foreground">
          {meal.calories}
        </div>
        <div className="mt-1 font-sans text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          kcal
        </div>
      </div>

      <div className="flex flex-none gap-1">
        <button
          type="button"
          onClick={() => onEditMeal(meal)}
          aria-label={`Edit ${meal.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/0 text-primary transition-colors hover:bg-primary/14"
        >
          <Edit className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onDeleteMeal(meal.id, meal.name)}
          aria-label={`Delete ${meal.name}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-primary/30 bg-primary/0 text-primary transition-colors hover:bg-primary/14"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default AnimatedMealCard;
