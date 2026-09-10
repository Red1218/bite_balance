import React from 'react';

interface DailySummaryProps {
  calories: number;
  goal: number;
  caloriesBurned?: number;
}

const DailySummary = ({ calories, goal, caloriesBurned = 0 }: DailySummaryProps) => {
  const percentage = Math.min(Math.round((calories / goal) * 100), 100);
  const remaining = Math.max(0, goal - calories);
  const circumference = 2 * Math.PI * 50;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const netCalories = calories - caloriesBurned;
  const netOver = netCalories > goal;

  return (
    <div className="elevation-glass flex items-center gap-[18px] rounded-[20px] p-[18px] animate-fade-in-up">
      {/* Circular Progress Ring */}
      <div className="relative h-[118px] w-[118px] flex-none">
        <svg
          width="118"
          height="118"
          viewBox="0 0 118 118"
          className="-rotate-90"
        >
          <circle
            cx="59"
            cy="59"
            r="50"
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="10"
          />
          <circle
            cx="59"
            cy="59"
            r="50"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <div className="font-mono text-[28px] font-bold leading-none tracking-[-0.045em] tabular-nums text-foreground">
            {calories.toLocaleString()}
          </div>
          <div className="font-sans text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            of {goal.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Ledger */}
      <div className="flex min-w-0 flex-1 flex-col gap-[11px]">
        <div>
          <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Remaining
          </div>
          <div className="mt-1.5 font-mono text-[26px] font-bold leading-none tracking-[-0.035em] tabular-nums text-foreground">
            {remaining.toLocaleString()}
            <span className="font-sans text-xs font-medium text-muted-foreground"> kcal</span>
          </div>
        </div>

        <div className="h-px bg-border" />

        <div className="flex gap-[14px]">
          <div>
            <div className="font-sans text-[10px] text-muted-foreground">Eaten</div>
            <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">
              {calories.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="font-sans text-[10px] text-muted-foreground">Burned</div>
            <div className="mt-1 font-mono text-sm font-semibold tabular-nums text-chart-steps">
              {Math.round(caloriesBurned).toLocaleString()}
            </div>
          </div>
          <div>
            <div className="font-sans text-[10px] text-muted-foreground">Net</div>
            <div
              className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                netOver ? 'text-primary' : 'text-foreground'
              }`}
            >
              {netCalories.toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailySummary;
