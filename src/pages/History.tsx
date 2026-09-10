import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
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
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  goal: number;
  meals: MealInfo[];
  reflection: string;
}

const glassTooltipStyle = {
  borderRadius: 12,
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--card) / 0.85)',
  backdropFilter: 'blur(20px) saturate(1.4)',
  color: 'hsl(var(--foreground))',
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
  fontSize: 12,
  boxShadow: '0 1px 0 hsl(0 0% 100% / 0.07) inset, 0 24px 48px -20px hsl(0 0% 0% / 0.9)',
};

const toDateStr = (d: Date) => d.toISOString().split('T')[0];

interface MonthDay {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

const History = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(toDateStr(new Date()));
  const [historyDays, setHistoryDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');

  // Calendar month grid state — fetched independently of the 7-day view above
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [monthData, setMonthData] = useState<Record<string, MonthDay>>({});
  const [monthLoading, setMonthLoading] = useState(true);

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
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            totalFiber: 0,
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
        acc[dateKey].totalProtein += Number(meal.protein || 0);
        acc[dateKey].totalCarbs += Number(meal.carbs || 0);
        acc[dateKey].totalFat += Number(meal.fat || 0);
        acc[dateKey].totalFiber += Number(meal.fiber || 0);
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
            totalProtein: 0,
            totalCarbs: 0,
            totalFat: 0,
            totalFiber: 0,
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
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
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

  const fetchMonthData = async () => {
    if (!user) return;
    setMonthLoading(true);
    try {
      const monthStart = toDateStr(calendarMonth);
      const nextMonth = new Date(calendarMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = toDateStr(new Date(nextMonth.getTime() - 86400000));

      const { data, error } = await supabase
        .from('daily_meals')
        .select('logged_date, calories, protein, carbs, fat')
        .eq('user_id', user.id)
        .gte('logged_date', monthStart)
        .lte('logged_date', monthEnd);

      if (error) throw error;

      const grouped: Record<string, MonthDay> = {};
      (data || []).forEach((meal: any) => {
        const key = meal.logged_date;
        if (!grouped[key]) {
          grouped[key] = { date: key, totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 };
        }
        grouped[key].totalCalories += Number(meal.calories || 0);
        grouped[key].totalProtein += Number(meal.protein || 0);
        grouped[key].totalCarbs += Number(meal.carbs || 0);
        grouped[key].totalFat += Number(meal.fat || 0);
      });
      setMonthData(grouped);
    } catch (err) {
      console.error('Error loading month data:', err);
    } finally {
      setMonthLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthData();
  }, [user, calendarMonth]);

  // Find summary for selected date
  const calorieGoal = Number(user?.user_metadata?.calorie_goal || 2200);
  const selectedDayData = historyDays.find((day) => day.date === selectedDate) || {
    date: selectedDate,
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    goal: calorieGoal,
    meals: [],
    reflection: getReflection(0, calorieGoal),
  };

  const selectedDayMeals = selectedDayData.meals;
  const selectedDayDelta = Math.round(selectedDayData.totalCalories - selectedDayData.goal);

  // Week mode: last 7 days, oldest first
  const weekChartData = [...historyDays]
    .reverse()
    .map((day) => ({
      label: new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }),
      protein: Math.round(day.totalProtein),
      carbs: Math.round(day.totalCarbs),
      fat: Math.round(day.totalFat),
      calories: day.totalCalories,
    }));

  // Month mode: bucket the displayed calendar month into ~4-5 weekly bars
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const monthChartData: { label: string; protein: number; carbs: number; fat: number; calories: number }[] = [];
  for (let weekStart = 1; weekStart <= daysInMonth; weekStart += 7) {
    const weekEnd = Math.min(weekStart + 6, daysInMonth);
    let calories = 0, protein = 0, carbs = 0, fat = 0;
    for (let day = weekStart; day <= weekEnd; day++) {
      const dateStr = toDateStr(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day));
      const d = monthData[dateStr];
      if (d) {
        calories += d.totalCalories;
        protein += d.totalProtein;
        carbs += d.totalCarbs;
        fat += d.totalFat;
      }
    }
    monthChartData.push({
      label: `${weekStart}–${weekEnd}`,
      protein: Math.round(protein),
      carbs: Math.round(carbs),
      fat: Math.round(fat),
      calories,
    });
  }

  const activeChartData = viewMode === 'week' ? weekChartData : monthChartData;
  const activeDaysLogged = viewMode === 'week'
    ? historyDays.filter((d) => d.totalCalories > 0)
    : Object.values(monthData).filter((d) => d.totalCalories > 0);
  const activeAverage = activeDaysLogged.length
    ? Math.round(activeChartData.reduce((sum, d) => sum + d.calories, 0) / activeChartData.filter((d) => d.calories > 0).length || 0)
    : 0;
  const avgDelta = activeAverage - calorieGoal;

  // Calendar grid cells for the displayed month
  const firstWeekday = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7; // Mon=0
  const calendarCells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) calendarCells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push({ date: toDateStr(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)), day });
  }

  const todayStr = toDateStr(new Date());

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">History</h1>
        <div className="flex gap-1.5 rounded-full border border-border bg-card p-[3px]">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`rounded-full px-3 py-1.5 font-sans text-[11px] font-semibold transition-colors ${
              viewMode === 'week' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`rounded-full px-3 py-1.5 font-sans text-[11px] font-semibold transition-colors ${
              viewMode === 'month' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Month
          </button>
        </div>
      </div>

      {/* Calendar month grid */}
      <div className="elevation-card flex flex-col gap-3.5 p-[15px]">
        <div className="flex items-center justify-between">
          <div className="font-sans text-sm font-medium text-foreground">
            {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCalendarMonth((m) => {
                const next = new Date(m); next.setMonth(next.getMonth() - 1); return next;
              })}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCalendarMonth((m) => {
                const next = new Date(m); next.setMonth(next.getMonth() + 1); return next;
              })}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center font-mono text-[10px] text-muted-foreground">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell, i) => {
            if (!cell.date) return <div key={i} className="aspect-square rounded-lg bg-muted/40" />;
            const d = monthData[cell.date];
            const intensity = d ? Math.max(0.14, Math.min(d.totalCalories / calorieGoal, 1)) : 0;
            const isFuture = cell.date > todayStr;
            const isToday = cell.date === todayStr;
            const isSelected = cell.date === selectedDate;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedDate(cell.date!)}
                disabled={isFuture}
                className="flex aspect-square items-center justify-center rounded-lg font-mono text-xs tabular-nums disabled:opacity-30"
                style={{
                  background: intensity > 0 ? `hsl(var(--primary) / ${intensity})` : 'hsl(var(--muted))',
                  color: intensity > 0.55 ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
                  boxShadow: isSelected
                    ? '0 0 0 2px hsl(var(--foreground) / 0.6)'
                    : isToday
                      ? '0 0 0 2px hsl(var(--primary) / 0.5)'
                      : undefined,
                }}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <div className="font-sans text-[10px] text-muted-foreground">Under goal</div>
          <div className="h-1.5 flex-1 rounded-full" style={{ background: 'linear-gradient(90deg, hsl(var(--primary) / 0.14), hsl(var(--primary)))' }} />
          <div className="font-sans text-[10px] text-muted-foreground">Over</div>
        </div>
      </div>

      {loading || monthLoading ? (
        <div className="elevation-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Syncing daily logs...</p>
        </div>
      ) : (
        <>
          {/* Average + trend chart */}
          <div className="elevation-card flex flex-col gap-3 p-[15px]">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {viewMode === 'week' ? 'Daily average' : 'Monthly daily average'}
                </div>
                <div className="mt-2 font-mono text-[28px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                  {activeAverage.toLocaleString()}
                  <span className="font-sans text-xs font-medium text-muted-foreground"> kcal</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-sans text-[10px] text-muted-foreground">vs goal</div>
                <div
                  className={`mt-1.5 font-mono text-sm font-semibold tabular-nums ${
                    avgDelta > 0 ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {avgDelta > 0 ? '+' : ''}
                  {avgDelta}
                </div>
              </div>
            </div>

            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeChartData} barCategoryGap={12}>
                  <XAxis
                    dataKey="label"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={10}
                    fontFamily='"IBM Plex Mono", ui-monospace, monospace'
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} contentStyle={glassTooltipStyle} />
                  <ReferenceLine y={calorieGoal} stroke="hsl(var(--primary) / 0.5)" strokeDasharray="3 3" />
                  <Bar dataKey="protein" stackId="macros" fill="hsl(var(--chart-protein))" />
                  <Bar dataKey="carbs" stackId="macros" fill="hsl(var(--chart-carbs))" />
                  <Bar dataKey="fat" stackId="macros" fill="hsl(var(--chart-fat))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex gap-4 border-t border-border pt-3">
              <div className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-sm bg-chart-protein" />
                <span className="font-sans text-[11px] text-muted-foreground">Protein</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-sm bg-chart-carbs" />
                <span className="font-sans text-[11px] text-muted-foreground">Carbs</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-[7px] w-[7px] rounded-sm bg-chart-fat" />
                <span className="font-sans text-[11px] text-muted-foreground">Fat</span>
              </div>
            </div>
          </div>

          {/* Selected day summary */}
          {selectedDayData.totalCalories > 0 || selectedDayMeals.length > 0 ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {new Date(selectedDayData.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  · selected
                </div>
                <div className="elevation-card flex items-center gap-3 p-[14px]">
                  <div className="min-w-0 flex-1">
                    <div className="font-sans text-sm font-medium text-foreground">
                      {selectedDayMeals.length} {selectedDayMeals.length === 1 ? 'meal' : 'meals'} logged
                    </div>
                    {selectedDayMeals.length > 0 && (
                      <div className="mt-1 truncate font-sans text-[11px] text-muted-foreground">
                        {selectedDayMeals.map((m) => m.name).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex-none text-right">
                    <div className="font-mono text-lg font-semibold tabular-nums text-foreground">
                      {selectedDayData.totalCalories.toLocaleString()}
                    </div>
                    <div
                      className={`mt-1 font-sans text-[9px] font-semibold uppercase tracking-[0.08em] ${
                        selectedDayDelta > 0 ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {selectedDayDelta > 0 ? `+${selectedDayDelta} over` : `${Math.abs(selectedDayDelta)} under`}
                    </div>
                  </div>
                </div>

                {selectedDayData.totalCalories > 0 && (
                  <div className="elevation-card grid grid-cols-4 gap-2 p-[14px] text-center">
                    <div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-chart-protein">
                        {Math.round(selectedDayData.totalProtein || 0)}g
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">Protein</p>
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-chart-carbs">
                        {Math.round(selectedDayData.totalCarbs || 0)}g
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">Carbs</p>
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-chart-fat">
                        {Math.round(selectedDayData.totalFat || 0)}g
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">Fat</p>
                    </div>
                    <div>
                      <div className="font-mono text-sm font-semibold tabular-nums text-chart-fiber">
                        {Math.round(selectedDayData.totalFiber || 0)}g
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">Fiber</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Meals */}
              {selectedDayMeals.length > 0 && (
                <div className="space-y-2">
                  <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Meals
                  </div>
                  <div className="elevation-card divide-y divide-border overflow-hidden p-0">
                    {selectedDayMeals.map((meal, index) => (
                      <div key={index} className="flex items-center justify-between px-[15px] py-[13px]">
                        <div>
                          <h4 className="font-sans text-sm font-medium text-foreground">{meal.name}</h4>
                          <p className="mt-0.5 font-sans text-[11px] text-muted-foreground">{meal.time}</p>
                        </div>
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {meal.calories}
                          <span className="font-sans text-[10px] font-normal text-muted-foreground"> cal</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Daily Reflection */}
              <div className="elevation-card p-[15px]">
                <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Reflection
                </div>
                <p className="mt-2 font-sans text-sm italic text-foreground">"{selectedDayData.reflection}"</p>
              </div>
            </div>
          ) : (
            <div className="elevation-card p-8 text-center">
              <p className="mb-2 text-sm text-muted-foreground">
                No data available for this date (
                {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                ).
              </p>
              <p className="text-sm text-muted-foreground">Start logging meals to see your history!</p>
            </div>
          )}

          {/* Recent week overview */}
          <div className="space-y-2">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Recent week
            </div>
            <div className="elevation-card divide-y divide-border overflow-hidden p-0">
              {historyDays.map((day, index) => {
                const pct = Math.round((day.totalCalories / day.goal) * 100);
                const over = day.totalCalories > day.goal;
                return (
                  <div key={index} className="flex items-center justify-between px-[15px] py-[13px]">
                    <div>
                      <h4 className="font-sans text-sm font-medium text-foreground">
                        {new Date(day.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </h4>
                      <p className="mt-0.5 font-sans text-[11px] text-muted-foreground">
                        {day.meals.length} meals logged
                      </p>
                      {day.totalCalories > 0 && (
                        <div className="mt-1 flex gap-2">
                          <span className="font-mono text-[10px] font-medium tabular-nums text-chart-protein">
                            {Math.round(day.totalProtein || 0)}g P
                          </span>
                          <span className="font-mono text-[10px] font-medium tabular-nums text-chart-carbs">
                            {Math.round(day.totalCarbs || 0)}g C
                          </span>
                          <span className="font-mono text-[10px] font-medium tabular-nums text-chart-fat">
                            {Math.round(day.totalFat || 0)}g F
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-mono text-sm font-semibold tabular-nums ${
                          over ? 'text-primary' : 'text-foreground'
                        }`}
                      >
                        {day.totalCalories} / {day.goal}
                      </span>
                      <p className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">{pct}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default History;
