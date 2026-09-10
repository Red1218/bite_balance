 import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useStreak = () => {
  const { user } = useAuth();
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const calculateStreak = async () => {
      setLoading(true);
      try {
        // Fetch distinct logged_dates for the last 60 days (enough to capture long streaks)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const startDate = sixtyDaysAgo.toISOString().split('T')[0];

        const { data, error } = await supabase
          .from('daily_meals')
          .select('logged_date')
          .eq('user_id', user.id)
          .gte('logged_date', startDate)
          .order('logged_date', { ascending: false });

        if (error) throw error;

        // Build a Set of unique dates that have meals
        const loggedDates = new Set(
          (data || []).map((r: { logged_date: string }) => r.logged_date)
        );

        // Count consecutive days going backwards from yesterday
        // (Today counts only if the user has already logged something today)
        let count = 0;
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Start from today — if today is logged, count it; otherwise start from yesterday
        const startFrom = loggedDates.has(todayStr) ? 0 : 1;

        for (let i = startFrom; i <= 60; i++) {
          const d = new Date();
          d.setDate(today.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];

          if (loggedDates.has(dateStr)) {
            count++;
          } else {
            break; // Streak broken
          }
        }

        setStreak(count);
      } catch (err) {
        console.error('Error calculating streak:', err);
      } finally {
        setLoading(false);
      }
    };

    calculateStreak();
  }, [user]);

  return { streak, loading };
};
