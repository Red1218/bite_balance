import { useWaterTracker } from '@/hooks/useWaterTracker';
import { Minus, Plus } from 'lucide-react';

const WaterTracker = () => {
  const { glasses, goal, loading, addGlass, removeGlass } = useWaterTracker();

  if (loading) {
    return <div className="h-[176px] rounded-[20px] bg-card" />;
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[20px] bg-card p-3.5">
      <span className="text-sm text-muted-foreground">Water</span>

      <div className="font-display text-[28px] font-bold leading-none text-foreground">
        {glasses}
        <span className="text-[15px] font-medium text-faint"> / {goal}</span>
      </div>

      {/* Each glass fills from the bottom with a little overshoot, like water settling. */}
      <div className="flex items-end gap-1" aria-hidden>
        {Array.from({ length: goal }).map((_, i) => (
          <span key={i} className="relative h-[22px] flex-1 overflow-hidden rounded-b-[5px] border-[1.5px] border-t-0 border-border">
            <span
              className="absolute inset-x-0 bottom-0 bg-chart-water"
              style={{ height: i < glasses ? '100%' : '0%', transition: 'height 520ms cubic-bezier(.34,1.4,.64,1)' }}
            />
          </span>
        ))}
      </div>

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={removeGlass}
          disabled={glasses <= 0}
          aria-label="Remove a glass"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-[14px] bg-muted text-foreground transition-transform active:scale-95 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={addGlass}
          disabled={glasses >= 20}
          aria-label="Add a glass"
          className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-[14px] bg-chart-water/15 text-sm font-semibold text-chart-water transition-transform active:scale-95 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" strokeWidth={2.4} />
          Glass
        </button>
      </div>
    </div>
  );
};

export default WaterTracker;
