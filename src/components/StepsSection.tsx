import React, { useState } from 'react';
import { RefreshCw, Flame, Activity } from 'lucide-react';
import { useHealthConnect } from '@/hooks/useHealthConnect';

const STEPS_GOAL = 10000;

const StepsSection = () => {
  const {
    isAvailable,
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnect();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleConnect = async () => {
    await requestPermissions();
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await fetchHealthData();
    setIsRefreshing(false);
  };

  if (!isConnected) {
    return (
      <div className="elevation-card col-span-2 flex flex-col items-center gap-3 p-5 text-center animate-fade-in-up">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Activity className="h-6 w-6" />
        </div>
        <p className="max-w-[280px] font-sans text-sm text-muted-foreground">
          {!isAvailable
            ? 'Health Connect is not available on this device.'
            : 'Connect to Health Connect to track steps and calories.'}
        </p>
        {isAvailable && (
          <button
            type="button"
            onClick={handleConnect}
            disabled={loading}
            className="flex h-11 w-full max-w-[220px] items-center justify-center gap-2 rounded-xl bg-primary font-sans text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {loading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Connecting...
              </>
            ) : (
              <>
                <Activity className="h-4 w-4" />
                Connect Health Connect
              </>
            )}
          </button>
        )}
      </div>
    );
  }

  const steps = healthData?.steps ?? 0;
  const percentage = Math.min(Math.round((steps / STEPS_GOAL) * 100), 100);
  const recentSteps = (healthData?.history?.steps ?? []).slice(-7);
  const maxRecent = Math.max(steps, ...recentSteps.map((d) => d.steps), 1);

  return (
    <div className="elevation-card flex flex-col gap-[10px] p-[14px] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Steps
        </span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-chart-steps">
            <Flame className="h-3 w-3" />
            {Math.round(healthData?.activeCalories ?? 0)} kcal
          </span>
          <button
            type="button"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            aria-label="Refresh steps"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="font-mono text-[26px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {steps.toLocaleString()}
      </div>

      {recentSteps.length > 0 ? (
        <div className="flex h-[22px] items-end gap-[3px]">
          {recentSteps.map((day, i) => (
            <div
              key={day.date ?? i}
              className="flex-1 rounded-sm bg-chart-steps/70"
              style={{ height: `${Math.max((day.steps / maxRecent) * 100, 8)}%` }}
            />
          ))}
        </div>
      ) : (
        <div className="h-[22px] w-full overflow-hidden rounded-sm bg-muted">
          <div
            className="h-full rounded-sm bg-chart-steps transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {percentage}% of {STEPS_GOAL.toLocaleString()}
      </p>
    </div>
  );
};

export default StepsSection;
