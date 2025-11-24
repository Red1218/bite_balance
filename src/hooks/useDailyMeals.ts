
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/manualClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface DailyMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  meal_time: string;
  logged_date: string;
  logged_at: string;
}

export const useDailyMeals = () => {
  const [meals, setMeals] = useState<DailyMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchTodaysMeals = async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_date', today)
        .order('logged_at', { ascending: false });

      if (error) throw error;
      setMeals(data || []);
    } catch (error) {
      console.error('Error fetching meals:', error);
      toast({
        title: "Error",
        description: "Failed to load today's meals",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMeal = async (id: string, updates: Partial<DailyMeal>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('daily_meals')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setMeals(prev => prev.map(meal => 
        meal.id === id ? { ...meal, ...updates } : meal
      ));

      toast({
        title: "Success",
        description: "Meal updated successfully"
      });
    } catch (error) {
      console.error('Error updating meal:', error);
      toast({
        title: "Error",
        description: "Failed to update meal",
        variant: "destructive"
      });
    }
  };

  const deleteMeal = async (id: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('daily_meals')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setMeals(prev => prev.filter(meal => meal.id !== id));

      toast({
        title: "Success",
        description: "Meal deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting meal:', error);
      toast({
        title: "Error",
        description: "Failed to delete meal",
        variant: "destructive"
      });
    }
  };

  const addMealFromSaved = async (savedMeal: any, mealTime: string = 'snack') => {
    if (!user) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('daily_meals')
        .insert({
          user_id: user.id,
          name: savedMeal.name,
          calories: savedMeal.calories,
          protein: savedMeal.protein || 0,
          carbs: savedMeal.carbs || 0,
          fat: savedMeal.fat || 0,
          fiber: savedMeal.fiber || 0,
          meal_time: mealTime,
          logged_date: today
        });

      if (error) throw error;

      // Refresh meals list
      await fetchTodaysMeals();

      toast({
        title: "Success",
        description: `${savedMeal.name} added to today's meals`
      });
    } catch (error) {
      console.error('Error adding meal:', error);
      toast({
        title: "Error",
        description: "Failed to add meal to today",
        variant: "destructive"
      });
    }
  };

  // Calculate totals
  const totals = meals.reduce((acc, meal) => ({
    calories: acc.calories + (meal.calories || 0),
    protein: acc.protein + (meal.protein || 0),
    carbs: acc.carbs + (meal.carbs || 0),
    fat: acc.fat + (meal.fat || 0),
    fiber: acc.fiber + (meal.fiber || 0)
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

  useEffect(() => {
    fetchTodaysMeals();
  }, [user]);

  return {
    meals,
    loading,
    totals,
    updateMeal,
    deleteMeal,
    addMealFromSaved,
    refetch: fetchTodaysMeals
  };
};
