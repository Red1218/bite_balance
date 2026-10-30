import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fmtLocalDate } from '@/lib/utils';
import { indexLogs, logOn, type Habit, type HabitLog, type HabitValues } from '@/lib/habits';
import { syncReminders } from '@/lib/habitReminders';

// Today's local date, refreshed when the app comes back to the foreground --
// so a page left open overnight moves on to the new day.
export const useLocalToday = () => {
  const [today, setToday] = useState(() => fmtLocalDate(new Date()));
  useEffect(() => {
    const sync = () => setToday(fmtLocalDate(new Date()));
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);
  return today;
};

export type LogPatch = Pick<HabitLog, 'status' | 'count' | 'note'>;

// Habits plus their logs between `from` and `to` (local dates).
export const useHabits = (from: string, to: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [itemsRes, logsRes] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('user_id', user.id).order('position').order('created_at'),
      supabase
        .from('checklist_checks')
        .select('item_id, checked_date, status, count, note')
        .eq('user_id', user.id)
        .gte('checked_date', from)
        .lte('checked_date', to),
    ]);
    if (itemsRes.error || logsRes.error) {
      console.error('Error loading habits:', itemsRes.error ?? logsRes.error);
      setError('Could not load your habits.');
    } else {
      // The table's check constraints guarantee the string unions.
      setHabits(itemsRes.data as Habit[]);
      setLogs(logsRes.data as HabitLog[]);
    }
    setLoading(false);
  }, [user, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const idx = useMemo(() => indexLogs(logs), [logs]);

  // Keep the phone's reminders in step with the latest logs; a failed load keeps the last good schedule.
  useEffect(() => {
    if (!loading && !error) syncReminders(habits, idx);
  }, [habits, idx, loading, error]);

  const failed = (description: string) => toast({ title: 'Error', description, variant: 'destructive' });

  // Sets (or clears, with null) one habit's record for a day. Optimistic; reverts if the write fails.
  const writeLog = async (itemId: string, date: string, next: LogPatch | null) => {
    if (!user) return false;
    const before = logOn(idx, itemId, date);
    const without = (list: HabitLog[]) => list.filter((l) => !(l.item_id === itemId && l.checked_date === date));
    const show = (log: HabitLog | null | undefined) => setLogs((prev) => (log ? [...without(prev), log] : without(prev)));

    show(next && { item_id: itemId, checked_date: date, ...next });
    const { error: writeError } = next
      ? await supabase
          .from('checklist_checks')
          .upsert({ item_id: itemId, user_id: user.id, checked_date: date, ...next }, { onConflict: 'item_id,checked_date' })
      : await supabase.from('checklist_checks').delete().eq('item_id', itemId).eq('checked_date', date);
    if (writeError) {
      console.error('Error saving habit log:', writeError);
      show(before);
      failed('Could not save that. Please try again.');
      return false;
    }
    return true;
  };

  const saveHabit = async (values: HabitValues, id?: string) => {
    if (!user) return null;
    const nextPosition = habits.reduce((max, h) => Math.max(max, h.position), -1) + 1;
    const clean = { ...values, category: values.category?.trim() || null };
    const { data, error: writeError } = id
      ? await supabase.from('checklist_items').update(clean).eq('id', id).select().single()
      : await supabase.from('checklist_items').insert({ ...clean, user_id: user.id, position: nextPosition }).select().single();
    if (writeError || !data) {
      console.error('Error saving habit:', writeError);
      failed('Could not save the habit. Please try again.');
      return null;
    }
    const saved = data as Habit;
    setHabits((prev) => (id ? prev.map((h) => (h.id === id ? saved : h)) : [...prev, saved]));
    return saved;
  };

  // Several new habits at once (starter suggestions).
  const addHabits = async (list: HabitValues[]) => {
    if (!user || !list.length) return false;
    const start = habits.reduce((max, h) => Math.max(max, h.position), -1) + 1;
    const { data, error: writeError } = await supabase
      .from('checklist_items')
      .insert(list.map((values, i) => ({ ...values, user_id: user.id, position: start + i })))
      .select();
    if (writeError || !data) {
      console.error('Error adding habits:', writeError);
      failed('Could not add those habits. Please try again.');
      return false;
    }
    setHabits((prev) => [...prev, ...(data as Habit[])]);
    return true;
  };

  // Renames a category on all its habits, archived ones too. A null `from` is the "Other" group;
  // a null `to` removes the category, moving its habits to Other.
  const renameCategory = async (from: string | null, to: string | null) => {
    if (!user) return false;
    const update = supabase.from('checklist_items').update({ category: to }).eq('user_id', user.id);
    const { error: writeError } = await (from === null ? update.is('category', null) : update.eq('category', from));
    if (writeError) {
      console.error('Error renaming category:', writeError);
      failed('Could not rename the category. Please try again.');
      return false;
    }
    setHabits((prev) => prev.map((h) => (h.category === from ? { ...h, category: to } : h)));
    return true;
  };

  // Moves habits into a category, new or existing.
  const moveToCategory = async (name: string, ids: string[]) => {
    const { error: writeError } = await supabase.from('checklist_items').update({ category: name }).in('id', ids);
    if (writeError) {
      console.error('Error moving habits to category:', writeError);
      failed('Could not save the category. Please try again.');
      return false;
    }
    setHabits((prev) => prev.map((h) => (ids.includes(h.id) ? { ...h, category: name } : h)));
    return true;
  };

  // Archive (archived_at = now) keeps all history; restore clears it.
  const setArchived = async (id: string, archived: boolean) => {
    const { data, error: writeError } = await supabase
      .from('checklist_items')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', id)
      .select()
      .single();
    if (writeError || !data) {
      console.error('Error archiving habit:', writeError);
      failed(`Could not ${archived ? 'archive' : 'restore'} the habit. Please try again.`);
      return false;
    }
    setHabits((prev) => prev.map((h) => (h.id === id ? (data as Habit) : h)));
    return true;
  };

  // Permanently removes the habit; its logs go with it (on delete cascade).
  const deleteHabit = async (id: string) => {
    const { error: writeError } = await supabase.from('checklist_items').delete().eq('id', id);
    if (writeError) {
      console.error('Error deleting habit:', writeError);
      failed('Could not delete the habit. Please try again.');
      return false;
    }
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => prev.filter((l) => l.item_id !== id));
    return true;
  };

  // Saves a new order and time of day for the given habits. Optimistic; reverts on failure.
  const reorderHabits = async (ordered: { id: string; time_of_day: Habit['time_of_day'] }[]) => {
    const before = habits;
    const next = new Map(ordered.map((o, i) => [o.id, { position: i, time_of_day: o.time_of_day }]));
    const changed = habits.filter((h) => {
      const n = next.get(h.id);
      return n && (n.position !== h.position || n.time_of_day !== h.time_of_day);
    });
    if (changed.length === 0) return true;
    setHabits((prev) =>
      prev
        .map((h) => (next.has(h.id) ? { ...h, ...next.get(h.id)! } : h))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
    );
    const results = await Promise.all(changed.map((h) => supabase.from('checklist_items').update(next.get(h.id)!).eq('id', h.id)));
    const writeError = results.find((r) => r.error)?.error;
    if (writeError) {
      console.error('Error saving habit order:', writeError);
      setHabits(before);
      failed('Could not save the new order. Please try again.');
      return false;
    }
    return true;
  };

  return { habits, logs, idx, loading, error, writeLog, saveHabit, addHabits, renameCategory, moveToCategory, setArchived, deleteHabit, reorderHabits };
};
