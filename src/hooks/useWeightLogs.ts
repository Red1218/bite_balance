import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { fmtLocalDate } from '@/lib/utils';

export interface WeightLog {
  logged_date: string;
  weight_kg: number;
}

const HISTORY_DAYS = 60;

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtLocalDate(d);
};

const avg = (logs: WeightLog[]) =>
  logs.length
    ? logs.reduce((sum, l) => sum + l.weight_kg, 0) / logs.length
    : null;

export const useWeightLogs = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const today = fmtLocalDate(new Date());

  const fetchLogs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weight_logs')
        .select('logged_date, weight_kg')
        .eq('user_id', user.id)
        .gte('logged_date', daysAgo(HISTORY_DAYS))
        .order('logged_date', { ascending: true });
      if (error) throw error;
      setLogs(
        (data ?? []).map((r) => ({
          logged_date: r.logged_date,
          weight_kg: Number(r.weight_kg),
        }))
      );
    } catch (err) {
      console.error('Error fetching weight logs:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Upserts today's weigh-in and keeps profiles.weight on the latest reading,
  // since the calorie goal and BMI are worked out from it.
  const logWeight = useCallback(
    async (weightKg: number) => {
      if (!user) return false;
      const kg = Math.round(weightKg * 100) / 100;
      const previous = logs;
      setLogs((prev) => [
        ...prev.filter((l) => l.logged_date !== today),
        { logged_date: today, weight_kg: kg },
      ]); // Optimistic update
      setSaving(true);
      try {
        const now = new Date().toISOString();
        const [logResult, profileResult] = await Promise.all([
          supabase
            .from('weight_logs')
            .upsert(
              {
                user_id: user.id,
                logged_date: today,
                weight_kg: kg,
                updated_at: now,
              },
              { onConflict: 'user_id,logged_date' }
            ),
          supabase
            .from('profiles')
            .update({ weight: kg, updated_at: now })
            .eq('user_id', user.id),
        ]);
        if (logResult.error) throw logResult.error;
        if (profileResult.error) throw profileResult.error;
        return true;
      } catch (err) {
        console.error('Error saving weight log:', err);
        setLogs(previous); // Revert on error
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user, today, logs]
  );

  const stats = useMemo(() => {
    const weekStart = daysAgo(6);
    const prevWeekStart = daysAgo(13);
    const thisWeek = logs.filter(
      (l) => l.logged_date >= weekStart && l.logged_date <= today
    );
    const prevWeek = logs.filter(
      (l) => l.logged_date >= prevWeekStart && l.logged_date < weekStart
    );
    return {
      todayLog: logs.find((l) => l.logged_date === today) ?? null,
      latest: logs.length ? logs[logs.length - 1] : null,
      weekAvg: avg(thisWeek),
      weekCount: thisWeek.length,
      prevWeekAvg: avg(prevWeek),
      recent: logs.filter((l) => l.logged_date >= daysAgo(13)),
    };
  }, [logs, today]);

  return { logs, loading, saving, logWeight, refetch: fetchLogs, ...stats };
};
