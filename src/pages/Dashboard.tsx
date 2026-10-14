import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import type { LayoutContext } from '@/components/AppLayout';
import { useDailyMeals, DailyMeal } from '@/hooks/useDailyMeals';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import EditMealDialog from '@/components/EditMealDialog';
import StepsSection from '@/components/StepsSection';
import DailySummary from '@/components/DailySummary';
import DashboardHeader from '@/components/DashboardHeader';
import TodaysMealsSection from '@/components/TodaysMealsSection';
import WaterTracker from '@/components/WaterTracker';
import WeightCard from '@/components/WeightCard';
import HabitsCard from '@/components/habits/HabitsCard';
import StreakBanner from '@/components/StreakBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const Dashboard = () => {
  const { meals, loading, totals, updateMeal, deleteMeal, refetch } = useDailyMeals();
  const { healthData } = useHealthConnect();
  const { mealsLoggedAt } = useAddMealSheet();
  const { openDrawer } = useOutletContext<LayoutContext>();

  // The Add Meal sheet is an overlay, not a route change -- Dashboard stays
  // mounted underneath it, so it needs this nudge to see meals logged there.
  useEffect(() => {
    if (mealsLoggedAt > 0) refetch();
  }, [mealsLoggedAt]);
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
    date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>

        <Skeleton className="h-[380px] w-full rounded-[28px]" />
        <Skeleton className="h-16 w-full rounded-[20px]" />
        <Skeleton className="h-16 w-full rounded-[20px]" />
        <div className="grid grid-cols-2 gap-[11px]">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <DashboardHeader todayDate={todayData.date} onOpenMenu={openDrawer} />

      <DailySummary
        calories={totals.calories}
        goal={dailyGoal}
        caloriesBurned={healthData?.activeCalories ?? 0}
        weightGoal={user?.user_metadata?.weight_goal}
        totals={totals}
      />

      <TodaysMealsSection meals={meals} onEditMeal={handleEditMeal} onDeleteMeal={handleDeleteMeal} />

      <HabitsCard />

      <StreakBanner />

      <div className="grid grid-cols-2 gap-3">
        <WaterTracker />
        <StepsSection />
      </div>

      <WeightCard />

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
