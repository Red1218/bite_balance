import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';

interface MacronutrientsTrackerProps {
  totals: {
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
  };
}

const MacronutrientsTracker = ({ totals }: MacronutrientsTrackerProps) => {
  const dailyTargets = {
    protein: 150,
    carbs: 250,
    fat: 80,
    fiber: 25,
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

  return (
    <Card className="metric-card animate-slide-in-right">
      <CardHeader className="pb-3 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          Macronutrients
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 sm:space-y-6">
        {macros.map((macro, index) => {
          const percentage = calculatePercentage(macro.current, macro.target);

          return (
            <div
              key={macro.label}
              className="space-y-2 sm:space-y-3"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base font-medium text-foreground">
                  {macro.label}
                </span>
                <span className="text-xs sm:text-sm text-muted-foreground">
                  {Math.round(macro.current)}
                  {macro.unit} / {macro.target}
                  {macro.unit}
                </span>
              </div>

              <div className="relative">
                <Progress
                  value={percentage}
                  className="h-2 sm:h-3 bg-muted/30"
                />
                <div
                  className="absolute inset-0 h-2 sm:h-3 rounded-full transition-all duration-700 ease-out"
                  style={{
                    background: `linear-gradient(90deg, ${macro.color} 0%, ${macro.color}80 100%)`,
                    width: `${percentage}%`,
                  }}
                />
              </div>

              <div className="text-right">
                <span
                  className="text-xs sm:text-sm font-medium"
                  style={{ color: macro.color }}
                >
                  {Math.round(percentage)}%
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default MacronutrientsTracker;
