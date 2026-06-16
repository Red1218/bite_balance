import { useState } from 'react';
import { useDailyMeals, DailyMeal } from '@/hooks/useDailyMeals';
import EditMealDialog from '@/components/EditMealDialog';
import StepsSection from '@/components/StepsSection';
import MacronutrientsTracker from '@/components/MacronutrientsTracker';
import DailySummary from '@/components/DailySummary';
import DashboardHeader from '@/components/DashboardHeader';
import TodaysMealsSection from '@/components/TodaysMealsSection';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const Dashboard = () => {
  const { meals, loading, totals, updateMeal, deleteMeal } = useDailyMeals();
  const [editingMeal, setEditingMeal] = useState<DailyMeal | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const dailyGoal = Number(user?.user_metadata?.calorie_goal || 2200);

  const handleEditMeal = (meal: DailyMeal) => {
    setEditingMeal(meal);
    setIsEditDialogOpen(true);
  };

  const handleDeleteMeal = async (mealId: string, mealName: string) => {
    if (window.confirm('Are you sure you want to delete this meal?')) {
      await deleteMeal(mealId);
      toast({
        title: 'Meal deleted',
        description: `"${mealName}" has been removed from your daily log.`,
      });
    }
  };

  const handleSaveMeal = async (updates: Partial<DailyMeal>) => {
    if (editingMeal) {
      await updateMeal(editingMeal.id, updates);
      toast({
        title: 'Meal updated',
        description: `"${updates.name || editingMeal.name}" has been updated.`,
      });
    }
  };

  const todayData = {
    date: new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };

  // Group meals by meal_time and calculate totals
  const groupedMeals = meals.reduce((acc, meal) => {
    const mealTime = meal.meal_time || 'snack';
    if (!acc[mealTime]) {
      acc[mealTime] = {
        meals: [],
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      };
    }
    acc[mealTime].meals.push(meal);
    acc[mealTime].totalCalories += meal.calories || 0;
    acc[mealTime].totalProtein += meal.protein || 0;
    acc[mealTime].totalCarbs += meal.carbs || 0;
    acc[mealTime].totalFat += meal.fat || 0;
    return acc;
  }, {} as Record<string, { meals: DailyMeal[]; totalCalories: number; totalProtein: number; totalCarbs: number; totalFat: number }>);

  if (loading) {
    return (
      <div className="space-y-6 max-w-full px-2 sm:px-4">
        <div className="flex flex-col gap-4">
          <div>
            <Skeleton className="h-6 sm:h-8 w-32 sm:w-48 mb-2" />
            <Skeleton className="h-4 sm:h-5 w-48 sm:w-64" />
          </div>
          <Skeleton className="h-8 sm:h-10 w-24 sm:w-32" />
        </div>

        <div className="space-y-6">
          <Skeleton className="h-64 sm:h-80 w-full" />
          <Skeleton className="h-48 sm:h-64 w-full" />
          <Skeleton className="h-48 sm:h-64 w-full" />
          <Skeleton className="h-48 sm:h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full px-2 sm:px-4">
      {/* Header */}
      <DashboardHeader todayDate={todayData.date} />

      {/* Mobile-First Layout - Stacked */}
      <div className="space-y-6">
        {/* Daily Summary */}
        <DailySummary calories={totals.calories} goal={dailyGoal} />

        {/* Today's Meals */}
        <TodaysMealsSection
          meals={meals}
          groupedMeals={groupedMeals}
          onEditMeal={handleEditMeal}
          onDeleteMeal={handleDeleteMeal}
        />

        {/* Macronutrients Tracker */}
        <MacronutrientsTracker totals={totals} />

        {/* Steps Section */}
        <div
          className="animate-slide-in-right"
          style={{ animationDelay: '400ms' }}
        >
          <StepsSection />
        </div>
      </div>

      <EditMealDialog
        meal={editingMeal}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSave={handleSaveMeal}
        isDailyMeal={true}
      />
    </div>
  );
};

export default Dashboard;
