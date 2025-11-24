
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/manualClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface SavedMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  tags: string[];
  notes: string;
}

export const useSavedMeals = () => {
  const [meals, setMeals] = useState<SavedMeal[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchSavedMeals = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('saved_meals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMeals(data || []);
    } catch (error) {
      console.error('Error fetching saved meals:', error);
      toast({
        title: "Error",
        description: "Failed to load saved meals",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updateMeal = async (id: string, updates: Partial<SavedMeal>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('saved_meals')
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
        .from('saved_meals')
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

  useEffect(() => {
    fetchSavedMeals();
  }, [user]);

  return {
    meals,
    loading,
    updateMeal,
    deleteMeal,
    refetch: fetchSavedMeals
  };
};
