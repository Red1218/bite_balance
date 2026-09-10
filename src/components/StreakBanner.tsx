import React from 'react';
import { useStreak } from '@/hooks/useStreak';
import { Flame, Trophy } from 'lucide-react';

const StreakBanner = () => {
  const { streak, loading } = useStreak();

  if (loading) return null;

  const isHighStreak = streak >= 7;

  if (streak === 0) {
    return (
      <div className="elevation-card flex items-center gap-3 px-4 py-3 animate-fade-in-up">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-muted text-muted-foreground">
          <Flame className="h-[18px] w-[18px]" />
        </div>
        <p className="text-sm text-muted-foreground">
          Log your first meal to start your streak!
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[13px] rounded-xl border border-chart-steps/26 bg-chart-steps/9 px-[15px] py-[13px] animate-fade-in-up">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-chart-steps/16 text-chart-steps">
        {isHighStreak ? (
          <Trophy className="h-[18px] w-[18px]" />
        ) : (
          <Flame className="h-[18px] w-[18px]" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-sans text-sm font-semibold text-chart-steps">
          {streak}-day streak
        </div>
        <div className="mt-[3px] font-sans text-[11px] text-muted-foreground">
          Log a meal today to keep it alive
        </div>
      </div>
      <div className="flex-none font-mono text-2xl font-bold tabular-nums text-chart-steps">
        {streak}
      </div>
    </div>
  );
};

export default StreakBanner;
