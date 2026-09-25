import { useState, useEffect } from 'react';
import { Loader2, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn, fmtLocalDate } from '@/lib/utils';
import EditMealDialog from '@/components/EditMealDialog';
import { MEAL_ORDER, MEAL_LABEL } from '@/components/MealReviewList';

interface MealInfo {
  id: string;
  name: string;
  calories: number;
  time: string;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  grams: number | null;
  unit: string;
  meal_time: string;
  logged_at: string;
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
}

interface MonthDay {
  date: string;
  totalCalories: number;
}

// How each day is judged against the goal -- shared by the week strip and the
// month calendar so both read as the same three tones, per the design.
type Tone = 'today' | 'over' | 'under' | 'within';
const dayTone = (calories: number, goal: number, isToday: boolean): Tone => {
  if (isToday) return 'today';
  if (calories > goal * 1.1) return 'over';
  if (calories < goal * 0.9) return 'under';
  return 'within';
};
const TONE_BAR_CLASS: Record<Tone, string> = {
  today: 'border border-dashed border-muted-foreground/70 bg-transparent',
  over: 'bg-primary',
  under: 'bg-muted-foreground/35',
  within: 'bg-foreground',
};
const TONE_CELL_CLASS: Record<Tone, string> = {
  today: 'border border-dashed border-muted-foreground/70 bg-transparent text-foreground',
  over: 'bg-primary text-primary-foreground',
  under: 'bg-muted-foreground/20 text-foreground',
  within: 'bg-foreground text-background',
};

// The week strip scales bars against goal * this factor, not a hard-coded max,
// so it stays proportional for any calorie target. ~1.2 mirrors the headroom
// a 2,200 kcal goal gets against a typical day's peak.
const SCALE_FACTOR = 1.2;
const barHeightPx = (calories: number, goal: number) =>
  Math.max(4, Math.min(72, (calories / (goal * SCALE_FACTOR)) * 72));
const goalLinePx = () => 72 * (1 - 1 / SCALE_FACTOR);

const formatPortion = (grams: number | null, unit: string) =>
  grams ? `${Math.round(grams)}${unit === 'g' ? 'g' : ` ${unit}`}` : null;

// Segmented macro bar is protein/carbs/fat only (kcal-weighted) -- fibre has
// no calories of its own, so it stays a number in the grid below, not a slice.
const macroBarSegments = (protein: number, carbs: number, fat: number) => {
  const energy = protein * 4 + carbs * 4 + fat * 9;
  if (!energy) return { p: 0, c: 0, f: 0 };
  return { p: (protein * 4 * 100) / energy, c: (carbs * 4 * 100) / energy, f: (fat * 9 * 100) / energy };
};

const History = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(fmtLocalDate(new Date()));
  const [historyDays, setHistoryDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [editingMeal, setEditingMeal] = useState<MealInfo | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Calendar month grid state -- fetched independently of the 7-day strip above
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [monthData, setMonthData] = useState<Record<string, MonthDay>>({});
  const [monthLoading, setMonthLoading] = useState(true);

  const fetchHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 6);

      const startDateStr = fmtLocalDate(sevenDaysAgo);
      const endDateStr = fmtLocalDate(today);

      // Load a wider range if the selected date is older than the 7-day strip.
      const fetchStart = selectedDate < startDateStr ? selectedDate : startDateStr;

      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .gte('logged_date', fetchStart)
        .lte('logged_date', endDateStr)
        .order('logged_at', { ascending: false });

      if (error) throw error;

      const calorieGoal = Number(user?.user_metadata?.calorie_goal || 2200);

      const grouped: Record<string, DaySummary> = {};
      const emptyDay = (dateStr: string): DaySummary => ({
        date: dateStr,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        totalFiber: 0,
        goal: calorieGoal,
        meals: [],
      });

      for (const meal of data || []) {
        const dateKey = meal.logged_date;
        if (!grouped[dateKey]) grouped[dateKey] = emptyDay(dateKey);
        const day = grouped[dateKey];
        day.meals.push({
          id: meal.id,
          name: meal.name,
          calories: Number(meal.calories),
          time: meal.meal_time ? meal.meal_time.charAt(0).toUpperCase() + meal.meal_time.slice(1) : 'Snack',
          protein: Number(meal.protein || 0),
          carbs: Number(meal.carbs || 0),
          fat: Number(meal.fat || 0),
          fiber: Number(meal.fiber || 0),
          grams: meal.grams ?? null,
          unit: meal.unit || 'g',
          meal_time: meal.meal_time || 'snack',
          logged_at: meal.logged_at,
        });
        day.totalCalories += Number(meal.calories);
        day.totalProtein += Number(meal.protein || 0);
        day.totalCarbs += Number(meal.carbs || 0);
        day.totalFat += Number(meal.fat || 0);
        day.totalFiber += Number(meal.fiber || 0);
      }

      // Build the 7-day strip, oldest first.
      const historyList: DaySummary[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const dateStr = fmtLocalDate(d);
        historyList.push(grouped[dateStr] ?? emptyDay(dateStr));
      }

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
      const monthStart = fmtLocalDate(calendarMonth);
      const nextMonth = new Date(calendarMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = fmtLocalDate(new Date(nextMonth.getTime() - 86400000));

      const { data, error } = await supabase
        .from('daily_meals')
        .select('logged_date, calories')
        .eq('user_id', user.id)
        .gte('logged_date', monthStart)
        .lte('logged_date', monthEnd);

      if (error) throw error;

      const grouped: Record<string, MonthDay> = {};
      for (const meal of data || []) {
        const key = meal.logged_date;
        if (!grouped[key]) grouped[key] = { date: key, totalCalories: 0 };
        grouped[key].totalCalories += Number(meal.calories || 0);
      }
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

  const handleEditMeal = (meal: MealInfo) => {
    setEditingMeal(meal);
    setIsEditDialogOpen(true);
  };

  const handleDeleteMeal = async (mealId: string, mealName: string) => {
    if (!user || !window.confirm(`Delete "${mealName}"?`)) return;
    const { error } = await supabase.from('daily_meals').delete().eq('id', mealId).eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete meal', variant: 'destructive' });
      return;
    }
    toast({ title: 'Meal deleted', description: `"${mealName}" has been removed.` });
    fetchHistory();
    fetchMonthData();
  };

  const handleSaveMeal = async (updates: Partial<MealInfo>) => {
    if (!user || !editingMeal) return;
    const { error } = await supabase
      .from('daily_meals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', editingMeal.id)
      .eq('user_id', user.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to update meal', variant: 'destructive' });
      return;
    }
    toast({ title: 'Meal updated', description: `"${updates.name || editingMeal.name}" has been updated.` });
    fetchHistory();
    fetchMonthData();
  };

  const calorieGoal = Number(user?.user_metadata?.calorie_goal || 2200);
  const todayStr = fmtLocalDate(new Date());

  const selectedDayData = historyDays.find((day) => day.date === selectedDate) || {
    date: selectedDate,
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    totalFiber: 0,
    goal: calorieGoal,
    meals: [],
  };
  const selectedDayDelta = Math.round(selectedDayData.totalCalories - selectedDayData.goal);
  const isSelectedToday = selectedDate === todayStr;

  const groupedMeals = MEAL_ORDER.map((mt) => ({
    mealTime: mt,
    items: selectedDayData.meals.filter((m) => m.meal_time === mt),
  })).filter((g) => g.items.length > 0);

  const { p: macroP, c: macroC, f: macroF } = macroBarSegments(
    selectedDayData.totalProtein,
    selectedDayData.totalCarbs,
    selectedDayData.totalFat
  );

  // Week strip stats
  const loggedDays = historyDays.filter((d) => d.totalCalories > 0);
  const weekAvg = loggedDays.length
    ? Math.round(loggedDays.reduce((sum, d) => sum + d.totalCalories, 0) / loggedDays.length)
    : 0;
  const weekRangeLabel = (() => {
    if (historyDays.length === 0) return '';
    const start = new Date(historyDays[0].date);
    const end = new Date(historyDays[historyDays.length - 1].date);
    const sameMonth = start.getMonth() === end.getMonth();
    const mon = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
    return sameMonth
      ? `${start.getDate()} – ${end.getDate()} ${mon(end)}`
      : `${start.getDate()} ${mon(start)} – ${end.getDate()} ${mon(end)}`;
  })();

  // Month calendar grid
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const firstWeekday = (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7; // Mon=0
  const calendarCells: { date: string | null; day: number | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) calendarCells.push({ date: null, day: null });
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push({ date: fmtLocalDate(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)), day });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">History</h1>
        <div className="flex gap-[2px] rounded-full bg-muted p-[3px]">
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={cn(
              'rounded-full px-3 py-1.5 font-sans text-[11px] font-semibold transition-colors',
              viewMode === 'week' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={cn(
              'rounded-full px-3 py-1.5 font-sans text-[11px] font-semibold transition-colors',
              viewMode === 'month' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            Month
          </button>
        </div>
      </div>

      {viewMode === 'week' ? (
        <div className="elevation-card flex flex-col gap-2.5 p-[14px]">
          <div className="relative grid grid-cols-7 gap-1">
            <div
              className="pointer-events-none absolute left-1.5 right-1.5 border-t border-dashed border-muted-foreground/50"
              style={{ top: goalLinePx() }}
            />
            {historyDays.map((day) => {
              const d = new Date(day.date);
              const isToday = day.date === todayStr;
              const isSelected = day.date === selectedDate;
              const tone = dayTone(day.totalCalories, day.goal, isToday);
              return (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setSelectedDate(day.date)}
                  className={cn(
                    'flex flex-col items-center gap-[7px] rounded-2xl py-2',
                    isSelected && 'bg-muted'
                  )}
                >
                  <span className={cn('font-sans text-[10px]', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                  </span>
                  <span className="flex h-[72px] w-full items-end justify-center">
                    <span
                      className={cn('w-3.5 rounded-[5px] box-border', TONE_BAR_CLASS[tone])}
                      style={{ height: barHeightPx(day.totalCalories, day.goal) }}
                    />
                  </span>
                  <span className={cn('font-mono text-xs font-semibold tabular-nums', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {d.getDate()}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-1 font-sans text-[11px] text-muted-foreground">
            <span>{weekRangeLabel}</span>
            <span>
              Avg <span className="font-mono text-[11px] font-semibold text-foreground">{weekAvg.toLocaleString()}</span>
              {' '}· goal {calorieGoal.toLocaleString()}
            </span>
          </div>
        </div>
      ) : (
        <div className={cn('elevation-card flex flex-col gap-3.5 p-[15px] transition-opacity', monthLoading && 'opacity-60')}>
          <div className="flex items-center justify-between">
            <div className="font-sans text-sm font-medium text-foreground">
              {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setCalendarMonth((m) => { const next = new Date(m); next.setMonth(next.getMonth() - 1); return next; })}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setCalendarMonth((m) => { const next = new Date(m); next.setMonth(next.getMonth() + 1); return next; })}
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
              const isFuture = cell.date > todayStr;
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;
              const tone = dayTone(d?.totalCalories ?? 0, calorieGoal, isToday);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedDate(cell.date!)}
                  disabled={isFuture}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-lg font-mono text-xs tabular-nums disabled:opacity-30',
                    d || isToday ? TONE_CELL_CLASS[tone] : 'bg-muted text-muted-foreground',
                    isSelected && 'ring-2 ring-foreground/60'
                  )}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 pt-0.5 font-sans text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/35" /> Under</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-foreground" /> Within</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Over</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="elevation-card flex flex-col items-center justify-center gap-3 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Syncing daily logs...</p>
        </div>
      ) : selectedDayData.totalCalories > 0 || selectedDayData.meals.length > 0 ? (
        <div className="space-y-4">
          <div className="elevation-card flex flex-col gap-3 p-[15px]">
            <div className="font-sans text-xs text-muted-foreground">
              {new Date(selectedDayData.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[32px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
                  {selectedDayData.totalCalories.toLocaleString()}
                </span>
                <span className="font-mono text-[13px] text-muted-foreground">/ {selectedDayData.goal.toLocaleString()} kcal</span>
              </div>
              <span className="font-sans text-[13px] font-medium text-foreground">
                {isSelectedToday
                  ? 'so far'
                  : selectedDayDelta > 0
                    ? `${selectedDayDelta} over`
                    : `${Math.abs(selectedDayDelta)} under`}
              </span>
            </div>
            <div className="flex h-1.5 gap-[2px] overflow-hidden rounded-full bg-muted">
              <div className="bg-chart-protein" style={{ width: `${macroP}%` }} />
              <div className="bg-chart-carbs" style={{ width: `${macroC}%` }} />
              <div className="bg-chart-fat" style={{ width: `${macroF}%` }} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <div className="font-mono text-sm font-semibold tabular-nums text-chart-protein">{Math.round(selectedDayData.totalProtein)}g</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Protein</p>
              </div>
              <div>
                <div className="font-mono text-sm font-semibold tabular-nums text-chart-carbs">{Math.round(selectedDayData.totalCarbs)}g</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Carbs</p>
              </div>
              <div>
                <div className="font-mono text-sm font-semibold tabular-nums text-chart-fat">{Math.round(selectedDayData.totalFat)}g</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Fat</p>
              </div>
              <div>
                <div className="font-mono text-sm font-semibold tabular-nums text-chart-fiber">{Math.round(selectedDayData.totalFiber)}g</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">Fibre</p>
              </div>
            </div>
          </div>

          {groupedMeals.length > 0 && (
            <div className="elevation-card divide-y divide-border p-0">
              {groupedMeals.map((group) => {
                const total = Math.round(group.items.reduce((s, m) => s + m.calories, 0));
                return (
                  <div key={group.mealTime} className="px-[15px]">
                    <div className="flex items-baseline justify-between py-2.5">
                      <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        {MEAL_LABEL[group.mealTime]}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">{total} kcal</span>
                    </div>
                    {group.items.map((meal) => {
                      const portion = formatPortion(meal.grams, meal.unit);
                      return (
                        <div key={meal.id} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-3">
                          <button
                            type="button"
                            onClick={() => handleEditMeal(meal)}
                            className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                          >
                            <span className="truncate font-sans text-sm font-medium text-foreground">{meal.name}</span>
                            {portion && <span className="font-mono text-[11px] text-muted-foreground">{portion}</span>}
                          </button>
                          <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{Math.round(meal.calories)}</span>
                          <button
                            type="button"
                            onClick={() => handleEditMeal(meal)}
                            aria-label={`Edit ${meal.name}`}
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-muted-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeal(meal.id, meal.name)}
                            aria-label={`Delete ${meal.name}`}
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-muted-foreground"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
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

export default History;
