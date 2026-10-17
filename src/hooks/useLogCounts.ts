import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const key = (name: string) => name.trim().toLowerCase();

/**
 * How often each food or meal name shows up in the user's recent log (last 500 entries), so
 * Saved can lead with the go-tos. Matching is by name, which is how a saved item lands in the log.
 */
export const useLogCounts = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!user) return;
    supabase
      .from('daily_meals')
      .select('name')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        const next = new Map<string, number>();
        (data ?? []).forEach((r) => next.set(key(r.name), (next.get(key(r.name)) ?? 0) + 1));
        setCounts(next);
      });
  }, [user]);

  return (name: string) => counts.get(key(name)) ?? 0;
};
