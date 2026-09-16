import React from 'react';
import { Edit, Trash2, CircleAlert } from 'lucide-react';

interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams?: number | null;
  unit?: string;
  meal_time: string;
  logged_at: string;
}

interface AnimatedMealCardProps {
  meal: MealItem;
  onEditMeal: (meal: any) => void;
  onDeleteMeal: (mealId: string, mealName: string) => void;
  /** Shown under the name when the surrounding list isn't already grouped by
   * meal time (History) -- omitted on Dashboard, where the section header
   * already says the meal time. */
  subLabel?: string;
}

// Tint the quantity tile by whichever macro contributes the most calories,
// so the tile itself hints at what kind of food this was.
const MACRO_TONE: Record<'p' | 'c' | 'f', string> = {
  p: 'border-chart-protein/30 text-chart-protein',
  c: 'border-chart-carbs/30 text-chart-carbs',
  f: 'border-chart-fat/30 text-chart-fat',
};

const dominantMacro = (protein: number, carbs: number, fat: number): 'p' | 'c' | 'f' => {
  const p = (protein || 0) * 4;
  const c = (carbs || 0) * 4;
  const f = (fat || 0) * 9;
  if (f > p && f > c) return 'f';
  if (p > c) return 'p';
  return 'c';
};

const AnimatedMealCard = ({ meal, onEditMeal, onDeleteMeal, subLabel }: AnimatedMealCardProps) => {
  const hasAmount = meal.grams != null;
  const toneClasses = hasAmount ? MACRO_TONE[dominantMacro(meal.protein, meal.carbs, meal.fat)] : '';

  return (
    <div className="elevation-card flex items-center gap-3 p-[13px]">
      {hasAmount ? (
        <div
          className={`flex h-[46px] w-[46px] flex-none flex-col items-center justify-center gap-px rounded-[12px] border bg-muted ${toneClasses}`}
        >
          <div className="font-mono text-[15px] font-semibold leading-none tabular-nums">
            {Math.round(meal.grams as number)}
          </div>
          <div className="font-mono text-[9px] leading-none tracking-[0.1em] text-muted-foreground">
            {(meal.unit || 'g').toUpperCase()}
          </div>
        </div>
      ) : (
        <div className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[12px] border border-dashed border-[hsl(38,80%,50%)]/45 bg-muted">
          <CircleAlert className="h-[17px] w-[17px] text-[hsl(38,90%,58%)]" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate font-sans text-[15px] font-medium leading-tight text-foreground">
          {meal.name}
        </div>
        {subLabel && (
          <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{subLabel}</div>
        )}
        {hasAmount ? (
          <div className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground">
            P {Math.round(meal.protein || 0)} · C {Math.round(meal.carbs || 0)} · F{' '}
            {Math.round(meal.fat || 0)}
          </div>
        ) : (
          <div className="mt-1 font-sans text-[11px] font-medium text-[hsl(38,88%,60%)]">Add the amount</div>
        )}
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
