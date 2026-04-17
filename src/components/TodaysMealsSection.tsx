import React from 'react';
import MealCategorySection from './MealCategorySection';

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
    <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
      <div className="seamless-meal-container">
        {mealCategories.map((category, index) => (
          <MealCategorySection
            key={category.key}
            category={category}
            index={index}
            onEditMeal={onEditMeal}
            onDeleteMeal={onDeleteMeal}
          />
        ))}
      </div>
    </div>
  );
};

export default TodaysMealsSection;
