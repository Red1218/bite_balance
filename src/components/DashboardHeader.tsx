import React from 'react';
import { CalendarDays } from 'lucide-react';

interface DashboardHeaderProps {
  todayDate: string;
}

const DashboardHeader = ({ todayDate }: DashboardHeaderProps) => {
  return (
    <div className="flex flex-col gap-4 animate-fade-in-up mb-2">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
          Dashboard
        </h1>
        <div className="flex items-center gap-2 text-muted-foreground mt-1">
          <CalendarDays className="w-4 h-4" />
          <p className="text-sm sm:text-base">{todayDate}</p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
