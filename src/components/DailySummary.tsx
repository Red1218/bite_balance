import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, TrendingUp } from 'lucide-react';

interface DailySummaryProps {
  calories: number;
  goal: number;
}

const DailySummary = ({ calories, goal }: DailySummaryProps) => {
  const percentage = Math.min(Math.round((calories / goal) * 100), 100);
  const remaining = Math.max(0, goal - calories);
  const circumference = 2 * Math.PI * 70;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Card className="metric-card border-primary/20 animate-fade-in-up">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="text-center space-y-4 sm:space-y-6">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Today's Intake</span>
          </div>

          {/* Circular Progress Ring - Mobile Optimized */}
          <div className="relative w-36 h-36 sm:w-44 sm:h-44 lg:w-48 lg:h-48 mx-auto">
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 160 160"
            >
              {/* Background ring */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                className="text-muted/20"
              />
              {/* Progress ring */}
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-primary transition-all duration-500 ease-out"
                style={{
                  strokeDashoffset: strokeDashoffset,
                }}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl sm:text-3xl lg:text-4xl font-bold text-primary">
                {calories.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground">
                from {goal.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {percentage}% achieved
              </div>
            </div>
          </div>

          {/* Stats Grid - Always Side by Side */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-4 sm:mt-6">
            <div className="bg-muted/10 rounded-lg p-2 sm:p-3 lg:p-4 border border-white/5 text-center">
              <div className="text-xs text-blue-400 font-medium mb-1 sm:mb-2">
                Consumed
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground leading-none">
                {calories.toLocaleString()}
              </div>
            </div>

            <div className="bg-muted/10 rounded-lg p-2 sm:p-3 lg:p-4 border border-white/5 text-center">
              <div className="text-xs text-green-400 font-medium mb-1 sm:mb-2">
                Goal
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground leading-none">
                {goal.toLocaleString()}
              </div>
            </div>

            <div className="bg-muted/10 rounded-lg p-2 sm:p-3 lg:p-4 border border-white/5 text-center">
              <div className="text-xs text-purple-400 font-medium mb-1 sm:mb-2">
                Left over
              </div>
              <div className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground leading-none">
                {remaining.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-sm">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-muted-foreground text-xs sm:text-sm">
              {remaining > 0
                ? `${remaining} calories remaining`
                : `${Math.abs(remaining)} calories over`}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailySummary;
