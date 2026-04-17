import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const History = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  // Mock history data
  const historyData = [
    {
      date: '2024-06-06',
      totalCalories: 1850,
      goal: 2200,
      meals: [
        { name: 'Oatmeal with Berries', calories: 350, time: 'Breakfast' },
        { name: 'Chicken Caesar Salad', calories: 480, time: 'Lunch' },
        { name: 'Apple with Peanut Butter', calories: 220, time: 'Snack' },
        {
          name: 'Grilled Salmon with Vegetables',
          calories: 800,
          time: 'Dinner',
        },
      ],
      reflection:
        'Felt good energy throughout the day. Could use more protein at breakfast.',
    },
    {
      date: '2024-06-05',
      totalCalories: 2100,
      goal: 2200,
      meals: [
        { name: 'Protein Smoothie', calories: 280, time: 'Breakfast' },
        { name: 'Turkey Sandwich', calories: 420, time: 'Lunch' },
        { name: 'Greek Yogurt', calories: 150, time: 'Snack' },
        { name: 'Pasta with Meat Sauce', calories: 750, time: 'Dinner' },
        { name: 'Dark Chocolate', calories: 500, time: 'Dessert' },
      ],
      reflection:
        'Hit my calorie goal perfectly. The chocolate was a nice treat!',
    },
    {
      date: '2024-06-04',
      totalCalories: 1950,
      goal: 2200,
      meals: [
        { name: 'Scrambled Eggs with Toast', calories: 400, time: 'Breakfast' },
        { name: 'Quinoa Buddha Bowl', calories: 550, time: 'Lunch' },
        { name: 'Protein Bar', calories: 200, time: 'Snack' },
        { name: 'Chicken Stir Fry', calories: 800, time: 'Dinner' },
      ],
      reflection:
        'Good variety of foods. Need to add more snacks to reach calorie goal.',
    },
  ];

  const selectedDayData = historyData.find((day) => day.date === selectedDate);

  const getProgressColor = (consumed: number, goal: number) => {
    const percentage = (consumed / goal) * 100;
    if (percentage < 70) return 'text-green-500';
    if (percentage < 90) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">History</h1>
        </div>

        {/* Date Selector */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="text-base font-medium text-foreground">
              Select Date
            </h3>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full p-3 border border-border rounded-xl bg-background/50 text-foreground backdrop-blur-sm"
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Daily Summary */}
        {selectedDayData ? (
          <div className="space-y-4">
            <div className="glass-card p-4">
              <h3 className="text-base font-medium text-foreground mb-4">
                Daily Summary -{' '}
                {new Date(selectedDayData.date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div
                    className={`text-2xl font-bold ${getProgressColor(selectedDayData.totalCalories, selectedDayData.goal)}`}
                  >
                    {selectedDayData.totalCalories}
                  </div>
                  <p className="text-xs text-muted-foreground">Consumed</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {selectedDayData.goal}
                  </div>
                  <p className="text-xs text-muted-foreground">Goal</p>
                </div>
                <div>
                  <div
                    className={`text-2xl font-bold ${getProgressColor(selectedDayData.totalCalories, selectedDayData.goal)}`}
                  >
                    {Math.round(
                      (selectedDayData.totalCalories / selectedDayData.goal) *
                        100
                    )}
                    %
                  </div>
                  <p className="text-xs text-muted-foreground">Achievement</p>
                </div>
              </div>
            </div>

            {/* Meals */}
            <div className="glass-card p-4">
              <h3 className="text-base font-medium text-foreground mb-4">
                Meals
              </h3>
              <div className="space-y-3">
                {selectedDayData.meals.map((meal, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
                  >
                    <div>
                      <h4 className="font-medium text-foreground text-sm">
                        {meal.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {meal.time}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-primary text-sm">
                        {meal.calories}
                      </span>
                      <p className="text-xs text-muted-foreground">cal</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Reflection */}
            <div className="glass-card p-4">
              <h3 className="text-base font-medium text-foreground mb-3">
                Daily Reflection
              </h3>
              <p className="text-foreground italic text-sm">
                "{selectedDayData.reflection}"
              </p>
            </div>
          </div>
        ) : (
          <div className="glass-card p-8 text-center">
            <p className="text-muted-foreground mb-2">
              No data available for this date.
            </p>
            <p className="text-sm text-muted-foreground">
              Start logging meals to see your history!
            </p>
          </div>
        )}

        {/* Weekly Overview */}
        <div className="glass-card p-4">
          <h3 className="text-base font-medium text-foreground mb-4">
            Recent Week Overview
          </h3>
          <div className="space-y-3">
            {historyData.map((day, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-background/50 rounded-lg border border-border"
              >
                <div>
                  <h4 className="font-medium text-foreground text-sm">
                    {new Date(day.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {day.meals.length} meals logged
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`font-bold text-sm ${getProgressColor(day.totalCalories, day.goal)}`}
                  >
                    {day.totalCalories} / {day.goal}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {Math.round((day.totalCalories / day.goal) * 100)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default History;
