import React from 'react';
import { useWaterTracker } from '@/hooks/useWaterTracker';
import { Plus } from 'lucide-react';

const WaterTracker = () => {
  const { glasses, goal, loading, addGlass, removeGlass } = useWaterTracker();

  if (loading) {
    return (
      <div className="elevation-card flex h-[164px] items-center justify-center p-[14px]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="elevation-card flex flex-col gap-[10px] p-[14px] animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Water
        </span>
        <button
          type="button"
          onClick={addGlass}
          disabled={glasses >= 20}
          aria-label="Add glass"
          className="flex h-6 w-6 items-center justify-center rounded-lg bg-chart-water/14 text-chart-water disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="font-mono text-[26px] font-bold leading-none tracking-[-0.03em] tabular-nums text-foreground">
        {glasses}
        <span className="font-sans text-xs font-medium text-muted-foreground"> / {goal} glasses</span>
      </div>

      <div className="flex gap-1">
        {Array.from({ length: goal }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => (i < glasses ? removeGlass() : addGlass())}
            aria-label={`Glass ${i + 1}`}
            className={`h-[22px] flex-1 rounded-[4px] transition-colors ${
              i < glasses ? 'bg-chart-water/80' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {glasses} of {goal} glasses
      </p>
    </div>
  );
};

export default WaterTracker;
