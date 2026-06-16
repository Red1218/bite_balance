import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

interface MacronutrientsTrackerProps {
  totals: {
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
}

const MacronutrientsTracker = ({ totals }: MacronutrientsTrackerProps) => {
  const { user } = useAuth();
  const calorieGoal = Number(user?.user_metadata?.calorie_goal || 2200);

  // Dynamic splits: 30% Protein, 45% Carbs, 25% Fat
  const dailyTargets = {
    protein: Math.round(user?.user_metadata?.protein_goal || (calorieGoal * 0.3) / 4),
    carbs: Math.round(user?.user_metadata?.carbs_goal || (calorieGoal * 0.45) / 4),
    fat: Math.round(user?.user_metadata?.fat_goal || (calorieGoal * 0.25) / 9),
    fiber: Math.round(user?.user_metadata?.fiber_goal || 25),
  };

  const calculatePercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const macros = [
    {
      label: 'Protein',
      current: totals.protein,
      target: dailyTargets.protein,
      color: '#ef4444',
      unit: 'g',
    },
    {
      label: 'Carbs',
      current: totals.carbs,
      target: dailyTargets.carbs,
      color: '#f59e0b',
      unit: 'g',
    },
    {
      label: 'Fat',
      current: totals.fat,
      target: dailyTargets.fat,
      color: '#8b5cf6',
      unit: 'g',
    },
    {
      label: 'Fiber',
      current: totals.fiber || 0,
      target: dailyTargets.fiber,
      color: '#10b981',
      unit: 'g',
    },
  ];

  // Calculate kcal values for energy pie chart
  const proteinKcal = totals.protein * 4;
  const carbsKcal = totals.carbs * 4;
  const fatKcal = totals.fat * 9;
  const totalKcal = proteinKcal + carbsKcal + fatKcal;

  const hasIntake = totalKcal > 0;

  const chartData = hasIntake
    ? [
        { name: 'Protein', value: proteinKcal, color: '#ef4444' },
        { name: 'Carbs', value: carbsKcal, color: '#f59e0b' },
        { name: 'Fat', value: fatKcal, color: '#8b5cf6' },
      ]
    : [{ name: 'Empty', value: 1, color: '#3f3f46' }]; // gray circle for no log

  return (
    <Card className="metric-card animate-slide-in-right">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Macronutrients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          {/* Donut Chart */}
          <div className="h-44 w-full flex items-center justify-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={70}
                  paddingAngle={hasIntake ? 4 : 0}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {hasIntake ? (
                <>
                  <span className="text-xl font-bold text-foreground">
                    {Math.round(totalKcal)}
                  </span>
                  <span className="text-xs text-muted-foreground">Logged kcal</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold text-muted-foreground">
                    No Intake
                  </span>
                  <span className="text-xs text-muted-foreground/60">0 kcal</span>
                </>
              )}
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-4">
            {macros.map((macro, index) => {
              const percentage = calculatePercentage(macro.current, macro.target);

              return (
                <div
                  key={macro.label}
                  className="space-y-1 sm:space-y-2"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: macro.color }} />
                      {macro.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(macro.current)}
                      {macro.unit} / {macro.target}
                      {macro.unit}
                    </span>
                  </div>

                  <div className="relative">
                    <Progress
                      value={percentage}
                      className="h-2 bg-muted/30"
                    />
                    <div
                      className="absolute inset-0 h-2 rounded-full transition-all duration-700 ease-out"
                      style={{
                        background: `linear-gradient(90deg, ${macro.color} 0%, ${macro.color}80 100%)`,
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MacronutrientsTracker;
