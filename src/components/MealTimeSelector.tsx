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
    {
      value: 'breakfast',
      label: 'Breakfast',
      icon: Coffee,
      color: 'text-amber-600',
    },
    { value: 'lunch', label: 'Lunch', icon: Sun, color: 'text-yellow-600' },
    {
      value: 'dinner',
      label: 'Dinner',
      icon: Sunset,
      color: 'text-orange-600',
    },
    { value: 'snack', label: 'Snack', icon: Moon, color: 'text-blue-600' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            <Clock className="w-5 h-5 inline mr-2" />
            Which meal is this for?
          </DialogTitle>
          <p className="text-sm text-gray-600 text-center mt-2">
            Adding "<strong>{mealName}</strong>" to today
          </p>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-4">
          {mealTimes.map((mealTime) => {
            const IconComponent = mealTime.icon;
            return (
              <Button
                key={mealTime.value}
                variant="outline"
                className="h-16 flex flex-col gap-1 hover:bg-red-50 hover:border-red-200"
                onClick={() => onSelect(mealTime.value)}
              >
                <IconComponent className={`w-5 h-5 ${mealTime.color}`} />
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
