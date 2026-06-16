import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, BarChart2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MealInfo {
  name: string;
  calories: number;
  time: string;
}

interface DaySummary {
  date: string;
  totalCalories: number;
  goal: number;
  meals: MealInfo[];
  reflection: string;
}

const History = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [historyDays, setHistoryDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  const getProgressColor = (consumed: number, goal: number) => {
    const percentage = (consumed / goal) * 100;
    if (percentage < 70) return 'text-green-500';
    if (percentage < 105) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getReflection = (calories: number, goal: number) => {
    if (calories === 0) return 'No meals logged for this date. Keep track of your nutrition to maintain consistency!';
    const pct = (calories / goal) * 100;
    if (pct >= 90 && pct <= 110) return 'Perfect! You hit your calorie target group with excellent precision. Keep it up!';
    if (pct > 110) return `You exceeded your calorie target by ${Math.round(calories - goal)} kcal. Focus on high-volume low-calorie foods tomorrow.`;
    return `You are under your calorie target by ${Math.round(goal - calories)} kcal. Consider adding a protein-rich snack to hit your target.`;
  };

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      
      const startDateStr = sevenDaysAgo.toISOString().split('T')[0];
      const endDateStr = today.toISOString().split('T')[0];
      
      // We will load a broader range if selectedDate is older than 7 days
      let fetchStart = startDateStr;
      if (selectedDate < startDateStr) {
        fetchStart = selectedDate;
      }

      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_date', fetchStart)
        .lte('logged_date', endDateStr)
        .order('logged_at', { ascending: false });

      if (error) throw error;

      const calorieGoal = Number(user?.user_metadata?.calorie_goal || 2200);

      // Group by date
      const grouped = (data || []).reduce((acc: Record<string, DaySummary>, meal: any) => {
        const dateKey = meal.logged_date;
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: dateKey,
            totalCalories: 0,
            goal: calorieGoal,
            meals: [],
            reflection: '',
          };
        }
        acc[dateKey].meals.push({
          name: meal.name,
          calories: Number(meal.calories),
          time: meal.meal_time ? meal.meal_time.charAt(0).toUpperCase() + meal.meal_time.slice(1) : 'Snack',
        });
        acc[dateKey].totalCalories += Number(meal.calories);
        return acc;
      }, {});

      // Build past 7 days representation
      const historyList: DaySummary[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        if (grouped[dateStr]) {
          const day = grouped[dateStr];
          day.reflection = getReflection(day.totalCalories, day.goal);
          historyList.push(day);
        } else {
          historyList.push({
            date: dateStr,
            totalCalories: 0,
            goal: calorieGoal,
            meals: [],
            reflection: getReflection(0, calorieGoal),
          });
        }
      }

      // If selected date is not in historyList (e.g. selected an older date), add it to grouped matches
      const selectedMatch = grouped[selectedDate] || {
        date: selectedDate,
        totalCalories: 0,
        goal: calorieGoal,
        meals: [],
        reflection: getReflection(0, calorieGoal),
      };
      
      if (!grouped[selectedDate]) {
        grouped[selectedDate] = selectedMatch;
      }
      
      // Ensure reflection is set for the selected date
      selectedMatch.reflection = getReflection(selectedMatch.totalCalories, selectedMatch.goal);

      setHistoryDays(historyList);
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user, selectedDate]);

  // Find summary for selected date
  // We can look up in historyDays or construct a fallback if we fetched it
  const selectedDayData = historyDays.find((day) => day.date === selectedDate) || {
    date: selectedDate,
    totalCalories: 0,
    goal: Number(user?.user_metadata?.calorie_goal || 2200),
    meals: [],
    reflection: getReflection(0, Number(user?.user_metadata?.calorie_goal || 2200)),
  };

  // Check if we are loading or need to fetch details for older date
  const selectedDayMeals = selectedDayData.meals;

  // Format Recharts data for the last 7 days chart
  const chartData = [...historyDays]
    .reverse()
    .map((day) => ({
      day: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
      calories: day.totalCalories,
      goal: day.goal,
    }));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">History</h1>
        </div>

        {/* Date Selector */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-base font-medium text-foreground">
              Select Date
            </h3>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-3 border border-border rounded-xl bg-background/50 text-foreground backdrop-blur-sm"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {loading ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Syncing daily logs...</p>
          </div>
        ) : (
          <>
            {/* Caloric Trend Chart */}
            <div className="glass-card p-4">
              <h3 className="text-base font-medium text-foreground mb-4 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                7-Day Caloric Trend
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <XAxis dataKey="day" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{fill: 'transparent'}}
                      contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'hsl(var(--background))', color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <ReferenceLine y={Number(user?.user_metadata?.calorie_goal || 2200)} stroke="hsl(var(--primary))" strokeDasharray="3 3" />
                    <Bar dataKey="calories" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Summary */}
            {selectedDayData.totalCalories > 0 || selectedDayMeals.length > 0 ? (
              <div className="space-y-4">
                <div className="glass-card p-4">
                  <h3 className="text-base font-medium text-foreground mb-4">
                    Daily Summary -{' '}
                    {new Date(selectedDayData.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div
                        className={`text-2xl font-bold ${getProgressColor(selectedDayData.totalCalories, selectedDayData.goal)}`}
                      >
                        {selectedDayData.totalCalories}
                      </div>
                      <p className="text-xs text-muted-foreground">Consumed</p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-foreground">
                        {selectedDayData.goal}
                      </div>
                      <p className="text-xs text-muted-foreground">Goal</p>
                    </div>
                    <div>
                      <div
                        className={`text-2xl font-bold ${getProgressColor(selectedDayData.totalCalories, selectedDayData.goal)}`}
                      >
                        {Math.round(
                          (selectedDayData.totalCalories / selectedDayData.goal) *
                            100
                        )}
                        %
                      </div>
                      <p className="text-xs text-muted-foreground">Achievement</p>
                    </div>
                  </div>
                </div>

                {/* Meals */}
                <div className="glass-card p-4">
                  <h3 className="text-base font-medium text-foreground mb-4">
                    Meals
                  </h3>
                  <div className="space-y-3">
                    {selectedDayMeals.map((meal, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                      >
                        <div>
                          <h4 className="font-medium text-foreground text-sm">
                            {meal.name}
                          </h4>
                          <p className="text-xs text-muted-foreground">
                            {meal.time}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-primary text-sm">
                            {meal.calories}
                          </span>
                          <p className="text-xs text-muted-foreground">cal</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Daily Reflection */}
                <div className="glass-card p-4">
                  <h3 className="text-base font-medium text-foreground mb-3">
                    Daily Reflection
                  </h3>
                  <p className="text-foreground italic text-sm">
                    "{selectedDayData.reflection}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-muted-foreground mb-2">
                  No data available for this date ({new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).
                </p>
                <p className="text-sm text-muted-foreground">
                  Start logging meals to see your history!
                </p>
              </div>
            )}

            {/* Weekly Overview */}
            <div className="glass-card p-4">
              <h3 className="text-base font-medium text-foreground mb-4">
                Recent Week Overview
              </h3>
              <div className="space-y-3">
                {historyDays.map((day, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                  >
                    <div>
                      <h4 className="font-medium text-foreground text-sm">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {day.meals.length} meals logged
                      </p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold text-sm ${getProgressColor(day.totalCalories, day.goal)}`}
                      >
                        {day.totalCalories} / {day.goal}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {Math.round((day.totalCalories / day.goal) * 100)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default History;
