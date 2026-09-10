import React from 'react';
import { Plus, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmptyMealsState = () => {
  return (
    <div className="elevation-card flex flex-col items-center gap-3 px-4 py-8 text-center sm:py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground sm:h-16 sm:w-16">
        <Utensils className="h-6 w-6 sm:h-8 sm:w-8" />
      </div>
      <p className="font-sans text-sm text-muted-foreground sm:text-base">
        No meals logged today yet.
      </p>
      <Link to="/add-meal" className="w-full sm:w-auto">
        <button
          type="button"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 font-sans text-sm font-semibold text-primary-foreground sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          Add Your First Meal
        </button>
      </Link>
    </div>
  );
};

export default EmptyMealsState;
