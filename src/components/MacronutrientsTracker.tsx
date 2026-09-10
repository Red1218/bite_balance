import React from 'react';
import { useAuth } from '@/contexts/AuthContext';

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

  const macros = [
    {
      label: 'Protein',
      current: totals.protein,
      target: dailyTargets.protein,
      dotClass: 'bg-chart-protein',
    },
    {
      label: 'Carbs',
      current: totals.carbs,
      target: dailyTargets.carbs,
      dotClass: 'bg-chart-carbs',
    },
    {
      label: 'Fat',
      current: totals.fat,
      target: dailyTargets.fat,
      dotClass: 'bg-chart-fat',
    },
    {
      label: 'Fiber',
      current: totals.fiber || 0,
      target: dailyTargets.fiber,
      dotClass: 'bg-chart-fiber',
    },
  ];

  // kcal contribution of each macro, used to proportion the balance bar
  const proteinKcal = totals.protein * 4;
  const carbsKcal = totals.carbs * 4;
  const fatKcal = totals.fat * 9;
  const totalKcal = proteinKcal + carbsKcal + fatKcal;
  const hasIntake = totalKcal > 0;

  return (
    <div className="flex flex-col gap-[11px] animate-slide-in-right">
      <div className="flex items-baseline justify-between">
        <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Macros
        </h2>
        <span className="font-mono text-[11px] text-muted-foreground">grams · goal</span>
      </div>

      <div className="elevation-card flex flex-col gap-[14px] p-[15px]">
        {/* Balance bar */}
        <div className="flex h-[9px] overflow-hidden rounded-full bg-muted">
          {hasIntake ? (
            <>
              <div
                className="bg-chart-protein"
                style={{ width: `${(proteinKcal / totalKcal) * 100}%` }}
              />
              <div className="w-px bg-card" />
              <div
                className="bg-chart-carbs"
                style={{ width: `${(carbsKcal / totalKcal) * 100}%` }}
              />
              <div className="w-px bg-card" />
              <div
                className="bg-chart-fat"
                style={{ width: `${(fatKcal / totalKcal) * 100}%` }}
              />
            </>
          ) : null}
        </div>

        {/* Values grid — single row, 4 columns */}
        <div className="grid grid-cols-4 gap-2">
          {macros.map((macro) => (
            <div key={macro.label}>
              <div className="flex items-center gap-1.5">
                <span className={`h-[7px] w-[7px] rounded-sm ${macro.dotClass}`} />
                <span className="font-sans text-[11px] font-medium text-muted-foreground">
                  {macro.label}
                </span>
              </div>
              <div className="mt-[7px] font-mono text-[17px] font-semibold tabular-nums text-foreground">
                {Math.round(macro.current)}
                <span className="font-mono text-[10px] font-normal text-muted-foreground">
                  /{macro.target}g
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MacronutrientsTracker;
