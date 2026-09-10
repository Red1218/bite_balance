import React from 'react';
import { Link } from 'react-router-dom';
import MealCategorySection from './MealCategorySection';
import EmptyMealsState from './EmptyMealsState';

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

interface TodaysMealsSectionProps {
  meals: MealItem[];
  groupedMeals: any;
  onEditMeal: (meal: any) => void;
  onDeleteMeal: (mealId: string, mealName: string) => void;
}

const TodaysMealsSection = ({
  meals,
  groupedMeals,
  onEditMeal,
  onDeleteMeal,
}: TodaysMealsSectionProps) => {
  const mealCategories = [
    {
      key: 'breakfast',
      name: 'Breakfast',
      emoji: '🌅',
      meals: groupedMeals.breakfast?.meals || [],
      totalCalories: groupedMeals.breakfast?.totalCalories || 0,
    },
    {
      key: 'lunch',
      name: 'Lunch',
      emoji: '🌞',
      meals: groupedMeals.lunch?.meals || [],
      totalCalories: groupedMeals.lunch?.totalCalories || 0,
    },
    {
      key: 'dinner',
      name: 'Dinner',
      emoji: '🌙',
      meals: groupedMeals.dinner?.meals || [],
      totalCalories: groupedMeals.dinner?.totalCalories || 0,
    },
    {
      key: 'snack',
      name: 'Snacks',
      emoji: '🍎',
      meals: groupedMeals.snack?.meals || [],
      totalCalories: groupedMeals.snack?.totalCalories || 0,
    },
  ];

  return (
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
          {mealCategories.map((category) => (
            <MealCategorySection
              key={category.key}
              category={category}
              onEditMeal={onEditMeal}
              onDeleteMeal={onDeleteMeal}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TodaysMealsSection;
