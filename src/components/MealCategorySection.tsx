import React from 'react';
import AnimatedMealCard from './AnimatedMealCard';

interface MealItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  grams?: number | null;
  unit?: string;
  meal_time: string;
  logged_at: string;
}

interface MealCategory {
  key: string;
  name: string;
  emoji: string;
  meals: MealItem[];
  totalCalories: number;
}

interface MealCategorySectionProps {
  category: MealCategory;
  onEditMeal: (meal: any) => void;
  onDeleteMeal: (mealId: string, mealName: string) => void;
}

const MealCategorySection = ({
  category,
  onEditMeal,
  onDeleteMeal,
}: MealCategorySectionProps) => {
  if (category.meals.length === 0) return null;

  const knownGrams = category.meals.filter((m) => m.grams != null);
  const totalGrams = knownGrams.reduce((sum, m) => sum + Number(m.grams), 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {category.name}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {knownGrams.length > 0 && `${Math.round(totalGrams)} g · `}
          {category.totalCalories} kcal
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {category.meals.map((meal) => (
          <AnimatedMealCard
            key={meal.id}
            meal={meal}
            onEditMeal={onEditMeal}
            onDeleteMeal={onDeleteMeal}
          />
        ))}
      </div>
    </div>
  );
};

export default MealCategorySection;
