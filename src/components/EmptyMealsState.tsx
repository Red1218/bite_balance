import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Utensils } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmptyMealsState = () => {
  return (
    <div className="text-center py-8 sm:py-12">
      <div className="w-12 h-12 sm:w-16 sm:h-16 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <Utensils className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mb-4 text-sm sm:text-base">
        No meals logged today yet.
      </p>
      <Link to="/add-meal">
        <Button className="primary-button w-full sm:w-auto">
          <Plus className="w-4 h-4 mr-2" />
          Add Your First Meal
        </Button>
      </Link>
    </div>
  );
};

export default EmptyMealsState;
