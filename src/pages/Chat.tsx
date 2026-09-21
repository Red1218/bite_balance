import { useEffect } from 'react';
import ChatMealLog from '@/components/ChatMealLog';
import { useDailyMeals } from '@/hooks/useDailyMeals';
import { useAuth } from '@/contexts/AuthContext';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const Chat = () => {
  const { user } = useAuth();
  const { totals, refetch } = useDailyMeals();
  const { mealsLoggedAt } = useAddMealSheet();

  // Chat logs meals itself (not through the Add Meal sheet), but other
  // surfaces bump this same signal -- keep the "kcal logged" header in sync.
  useEffect(() => {
    if (mealsLoggedAt > 0) refetch();
  }, [mealsLoggedAt]);

  const calorieGoal = Number(user?.user_metadata?.calorie_goal) || 2200;

  return <ChatMealLog calorieGoal={calorieGoal} loggedKcal={Math.round(totals.calories)} />;
};

export default Chat;
