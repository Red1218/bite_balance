import React, { useState } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { HealthData } from '@/hooks/useHealthConnect';

interface ActivityCalendarDrawerProps {
  healthData: HealthData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProgressRings = ({ stepProgress, calProgress }: { stepProgress: number, calProgress: number }) => {
  const stepR = 8;
  const calR = 4.5;
  const stepC = 2 * Math.PI * stepR;
  const calC = 2 * Math.PI * calR;
  
  const stepDash = `${(stepProgress / 100) * stepC} ${stepC}`;
  const calDash = `${(calProgress / 100) * calC} ${calC}`;
  
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="transform -rotate-90">
      {/* Background Rings */}
      <circle cx="12" cy="12" r={stepR} fill="none" stroke="var(--ring-steps-bg, rgba(34, 197, 94, 0.15))" strokeWidth="2.5" />
      <circle cx="12" cy="12" r={calR} fill="none" stroke="var(--ring-cal-bg, rgba(249, 115, 22, 0.15))" strokeWidth="2.5" />
      
      {/* Progress Rings */}
      {stepProgress > 0 && (
        <circle cx="12" cy="12" r={stepR} fill="none" stroke="rgb(34, 197, 94)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={stepDash} />
      )}
      {calProgress > 0 && (
        <circle cx="12" cy="12" r={calR} fill="none" stroke="rgb(249, 115, 22)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={calDash} />
      )}
    </svg>
  );
};

const ActivityCalendarDrawer: React.FC<ActivityCalendarDrawerProps> = ({
  healthData,
  open,
  onOpenChange,
}) => {
  const [currentDate] = useState(new Date());
  
  // Calculate averages
  let avgSteps = 0;
  let avgCalories = 0;
  let daysWithData = 0;

  if (healthData?.history) {
    const { steps, calories } = healthData.history;
    daysWithData = steps.length;
    avgSteps = daysWithData ? Math.round(steps.reduce((acc, curr) => acc + curr.steps, 0) / daysWithData) : 0;
    avgCalories = daysWithData ? Math.round(calories.reduce((acc, curr) => acc + curr.activeCalories, 0) / daysWithData) : 0;
  }

  // Generate calendar grid for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  
  const calendarDays = [];
  
  // Padding for previous month
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  
  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i);
    calendarDays.push(date);
  }

  const getDayData = (date: Date) => {
    if (!healthData?.history) return { steps: 0, calories: 0 };
    
    // We need to format it in local time correctly to match the ISO string format from healthConnect.ts
    // The healthConnect.ts sets hours to 0,0,0,0 then ISO string
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dateStr = d.toLocaleDateString('sv-SE'); // returns YYYY-MM-DD in local time
    
    const stepData = healthData.history.steps.find(d => d.date.startsWith(dateStr));
    const calData = healthData.history.calories.find(d => d.date.startsWith(dateStr));
    
    return {
      steps: stepData?.steps || 0,
      calories: calData?.activeCalories || 0,
    };
  };

  const monthName = currentDate.toLocaleString('default', { month: 'short' });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh]">
        <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted mt-4 mb-2" />
        <DrawerHeader className="text-left pb-2">
          <div className="flex justify-between items-center w-full px-2">
            <DrawerTitle className="text-2xl font-bold">{year}</DrawerTitle>
            <Button variant="ghost" className="text-muted-foreground">Today</Button>
          </div>
        </DrawerHeader>

        <div className="px-6 py-4 overflow-y-auto pb-10">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-4">{monthName} <span className="text-muted-foreground text-sm font-normal ml-2">All goals reached: 0/30</span></h2>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-4 rounded-full bg-green-500 inline-block"></span>
                  Avg. steps
                </p>
                <p className="font-bold text-lg">{avgSteps.toLocaleString()} <span className="text-sm font-normal">steps</span></p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-4 rounded-full bg-orange-500 inline-block"></span>
                  Avg active calories
                </p>
                <p className="font-bold text-lg">{avgCalories.toLocaleString()} <span className="text-sm font-normal">kcal</span></p>
              </div>
            </div>

            {/* Calendar Header */}
            <div className="grid grid-cols-7 text-center text-sm text-muted-foreground mb-4">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-y-6 gap-x-2 text-center">
              {calendarDays.map((date, index) => {
                if (!date) {
                  return <div key={`empty-${index}`} className="h-16"></div>;
                }

                const dayData = getDayData(date);
                const stepProgress = Math.min((dayData.steps / 10000) * 100, 100);
                const calProgress = Math.min((dayData.calories / 500) * 100, 100);
                
                // Set hours to 23:59 for proper "past" checking
                const checkDate = new Date(date);
                checkDate.setHours(23, 59, 59, 999);
                const isPastOrToday = checkDate <= new Date() || date.toDateString() === new Date().toDateString();
                const isToday = date.toDateString() === new Date().toDateString();
                
                return (
                  <div key={date.toISOString()} className="flex flex-col items-center justify-start h-16">
                    <span className={`text-sm mb-2 w-7 h-7 flex items-center justify-center ${isToday ? 'bg-foreground text-background font-bold rounded-full' : ''}`}>
                      {date.getDate()}
                    </span>
                    
                    {isPastOrToday && (
                      <div className="mt-auto">
                        <ProgressRings stepProgress={stepProgress} calProgress={calProgress} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ActivityCalendarDrawer;
