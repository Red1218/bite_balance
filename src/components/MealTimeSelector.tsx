import React, { useEffect, useState } from 'react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Coffee, Sun, Sunset, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { defaultSlotForNow } from '@/lib/mealTime';

interface MealTimeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mealTime: string) => void;
  mealName: string;
  kcal?: number;
}

const mealTimes = [
  { value: 'breakfast', label: 'Breakfast', icon: Coffee },
  { value: 'lunch', label: 'Lunch', icon: Sun },
  { value: 'dinner', label: 'Dinner', icon: Sunset },
  { value: 'snack', label: 'Snack', icon: Moon },
] as const;

const MealTimeSelector: React.FC<MealTimeSelectorProps> = ({
  open,
  onOpenChange,
  onSelect,
  mealName,
  kcal,
}) => {
  const [selected, setSelected] = useState(defaultSlotForNow);

  useEffect(() => {
    if (open) setSelected(defaultSlotForNow());
  }, [open]);

  const selectedLabel = mealTimes.find((m) => m.value === selected)?.label ?? 'Snack';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-3xl">
        <DrawerTitle className="sr-only">Add to today</DrawerTitle>
        <div className="px-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] pt-3 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 font-display font-semibold text-lg text-foreground truncate">
              {mealName}
            </div>
            {typeof kcal === 'number' && (
              <div className="font-mono font-semibold text-base tabular-nums text-foreground flex-none">
                {Math.round(kcal)}
                <span className="text-[10px] font-normal text-muted-foreground ml-1">kcal</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {mealTimes.map((mealTime) => {
              const Icon = mealTime.icon;
              const active = selected === mealTime.value;
              return (
                <button
                  key={mealTime.value}
                  type="button"
                  onClick={() => setSelected(mealTime.value)}
                  className={cn(
                    'flex-1 h-14 rounded-xl border flex flex-col items-center justify-center gap-1 transition-colors',
                    active
                      ? 'bg-primary/12 border-primary/40 text-primary'
                      : 'bg-muted border-border text-muted-foreground'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] font-medium">{mealTime.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onSelect(selected)}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
          >
            Add to {selectedLabel.toLowerCase()}
            {typeof kcal === 'number' ? ` · ${Math.round(kcal)} kcal` : ''}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default MealTimeSelector;
