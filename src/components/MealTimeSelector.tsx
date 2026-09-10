import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock, Coffee, Sun, Sunset, Moon } from 'lucide-react';

interface MealTimeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (mealTime: string) => void;
  mealName: string;
}

const MealTimeSelector: React.FC<MealTimeSelectorProps> = ({
  open,
  onOpenChange,
  onSelect,
  mealName,
}) => {
  const mealTimes = [
    { value: 'breakfast', label: 'Breakfast', icon: Coffee },
    { value: 'lunch', label: 'Lunch', icon: Sun },
    { value: 'dinner', label: 'Dinner', icon: Sunset },
    { value: 'snack', label: 'Snack', icon: Moon },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-center font-display">
            <Clock className="w-5 h-5 inline mr-2 text-primary" />
            Which meal is this for?
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center mt-2">
            Adding "<strong className="text-foreground">{mealName}</strong>" to today
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {mealTimes.map((mealTime) => {
            const IconComponent = mealTime.icon;
            return (
              <Button
                key={mealTime.value}
                variant="outline"
                className="h-16 flex flex-col gap-1 rounded-xl hover:bg-primary/10 hover:border-primary/30"
                onClick={() => onSelect(mealTime.value)}
              >
                <IconComponent className="w-5 h-5 text-primary" />
                <span className="text-sm">{mealTime.label}</span>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MealTimeSelector;
