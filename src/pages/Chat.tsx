import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import ChatMealLog from '@/components/ChatMealLog';
import { useDailyMeals } from '@/hooks/useDailyMeals';
import { useAuth } from '@/contexts/AuthContext';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const Chat = () => {
  const { user } = useAuth();
  const { meals, totals, refetch } = useDailyMeals();
  const { mealsLoggedAt } = useAddMealSheet();

  // Chat logs meals itself (not through the Add Meal sheet), but other
  // surfaces bump this same signal -- keep the day meter in sync either way.
  useEffect(() => {
    if (mealsLoggedAt > 0) refetch();
  }, [mealsLoggedAt]);

  const calorieGoal = Number(user?.user_metadata?.calorie_goal) || 2200;
  const eaten = Math.round(totals.calories);
  const pct = (kcal: number) => `${Math.min(100, Math.max(0, (kcal / calorieGoal) * 100))}%`;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/12 border border-primary/28">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Chat</h1>
          <p className="text-xs text-muted-foreground">Tell me what you ate, I'll log it.</p>
        </div>
      </div>

      <div className="space-y-2 border-b border-border pb-4">
        <div className="flex items-end justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-2xl font-bold tabular-nums text-foreground">{eaten.toLocaleString()}</span>
            <span className="font-mono text-xs text-muted-foreground">/ {calorieGoal.toLocaleString()} kcal today</span>
          </div>
          <div className="flex flex-none items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1">
            <span className="h-[5px] w-[5px] rounded-full bg-chart-fiber" />
            <span className="font-mono text-[10px] text-muted-foreground">
              {meals.length} entr{meals.length === 1 ? 'y' : 'ies'}
            </span>
          </div>
        </div>
        <div className="flex h-[5px] gap-px overflow-hidden rounded-full bg-muted">
          <div className="bg-chart-protein transition-all" style={{ width: pct(totals.protein * 4) }} />
          <div className="bg-chart-carbs transition-all" style={{ width: pct(totals.carbs * 4) }} />
          <div className="bg-chart-fat transition-all" style={{ width: pct(totals.fat * 9) }} />
        </div>
      </div>

      <ChatMealLog />
    </div>
  );
};

export default Chat;
