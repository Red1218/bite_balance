import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { fmtLocalDate } from '@/lib/utils';
import { bestStreak, weekLogged } from '@/lib/logStats';

const PAGE = 1000; // Supabase returns at most 1000 rows per request

export interface LogStats {
  daysLogged: number;
  meals: number;
  bestStreak: number;
  /** Monday-first: this week's days with at least one meal. */
  week: boolean[];
}

/** All-time logging numbers for the You page, from each logged meal's date. */
export const useLogStats = () => {
  const { user } = useAuth();
  const { mealsLoggedAt } = useAddMealSheet();
  const [stats, setStats] = useState<LogStats | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const dates: string[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('daily_meals')
          .select('logged_date')
          .eq('user_id', user.id)
          .range(from, from + PAGE - 1);
        if (error) {
          console.error('Error loading logging stats:', error);
          return;
        }
        dates.push(...data.map((r) => r.logged_date));
        if (data.length < PAGE) break;
      }
      if (cancelled) return;
      const days = new Set(dates);
      setStats({
        daysLogged: days.size,
        meals: dates.length,
        bestStreak: bestStreak(dates),
        week: weekLogged(days, fmtLocalDate(new Date())),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, mealsLoggedAt]);

  return stats;
};
