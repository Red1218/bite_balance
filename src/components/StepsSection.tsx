import { useState } from 'react';
import { RefreshCw, Activity } from 'lucide-react';
import { useHealthConnect } from '@/hooks/useHealthConnect';

const STEPS_GOAL = 10000;

const StepsSection = () => {
  const {
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData,
  } = useHealthConnect();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    await fetchHealthData();
    setIsRefreshing(false);
  };

  if (!isConnected) {
    return (
      <div className="elevation-card col-span-2 flex flex-col items-center gap-3 p-5 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Activity className="h-6 w-6" />
        </div>
        <p className="max-w-[280px] font-sans text-sm text-muted-foreground">
          Connect to Health Connect to track steps and calories.
        </p>
        <button
          type="button"
          onClick={requestPermissions}
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
      </div>
    );
  }

  const steps = healthData?.steps ?? 0;
  const percentage = Math.min(Math.round((steps / STEPS_GOAL) * 100), 100);

  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-card p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Steps</span>
        <button
          type="button"
          onClick={handleRefreshData}
          disabled={isRefreshing}
          aria-label="Refresh steps"
          className="-m-3 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="font-display text-[28px] font-bold leading-none text-foreground">{steps.toLocaleString()}</div>
      <p className="text-[13px] text-faint">of {STEPS_GOAL.toLocaleString()} today</p>

      <div className="mt-auto flex flex-col gap-2">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-chart-steps"
            style={{ width: `${percentage}%`, transition: 'width 900ms var(--ease-settle) 300ms' }}
          />
        </div>
        <span className="text-[13px] text-muted-foreground">
          Burned <strong className="font-semibold text-foreground">{Math.round(healthData?.activeCalories ?? 0)}</strong> kcal
        </span>
      </div>
    </div>
  );
};

export default StepsSection;
