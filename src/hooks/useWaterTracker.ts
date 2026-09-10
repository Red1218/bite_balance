import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const DAILY_GOAL = 8;

export const useWaterTracker = () => {
  const { user } = useAuth();
  const [glasses, setGlassesState] = useState(0);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const fetchWater = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('water_logs')
        .select('glasses')
        .eq('user_id', user.id)
        .eq('logged_date', today)
        .maybeSingle();

      setGlassesState(data?.glasses ?? 0);
    } catch (err) {
      console.error('Error fetching water log:', err);
    } finally {
      setLoading(false);
    }
  }, [user, today]);

  useEffect(() => {
    fetchWater();
  }, [fetchWater]);

  const upsertGlasses = useCallback(
    async (newCount: number) => {
      if (!user) return;
      const clamped = Math.max(0, Math.min(newCount, 20));
      setGlassesState(clamped); // Optimistic update
      try {
        await supabase.from('water_logs').upsert(
          {
            user_id: user.id,
            logged_date: today,
            glasses: clamped,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,logged_date' }
        );
      } catch (err) {
        console.error('Error saving water log:', err);
        // Revert on error
        fetchWater();
      }
    },
    [user, today, fetchWater]
  );

  const addGlass = useCallback(() => {
    upsertGlasses(glasses + 1);
  }, [glasses, upsertGlasses]);

  const removeGlass = useCallback(() => {
    upsertGlasses(glasses - 1);
  }, [glasses, upsertGlasses]);

  return {
    glasses,
    goal: DAILY_GOAL,
    loading,
    addGlass,
    removeGlass,
    setGlasses: upsertGlasses,
  };
};
