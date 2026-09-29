import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { fmtLocalDate } from '@/lib/utils';
import { isChecked, type ChecklistCheck, type ChecklistItem, type ChecklistItemValues } from '@/lib/checklist';

// Today's local date, refreshed when the app comes back to the foreground --
// so a card left open overnight moves on to the new day's list.
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

export const useChecklist = (from: string, to: string) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [checks, setChecks] = useState<ChecklistCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const [itemsRes, checksRes] = await Promise.all([
      supabase.from('checklist_items').select('*').eq('user_id', user.id).order('position').order('created_at'),
      supabase
        .from('checklist_checks')
        .select('item_id, checked_date')
        .eq('user_id', user.id)
        .gte('checked_date', from)
        .lte('checked_date', to),
    ]);
    if (itemsRes.error || checksRes.error) {
      console.error('Error loading checklist:', itemsRes.error ?? checksRes.error);
      setError('Could not load your checklist.');
    } else {
      setItems(itemsRes.data);
      setChecks(checksRes.data);
    }
    setLoading(false);
  }, [user, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const failed = (description: string) => toast({ title: 'Error', description, variant: 'destructive' });

  // Optimistic: flip locally first, flip back if the write fails.
  const toggle = async (itemId: string, date: string) => {
    if (!user) return;
    const wasChecked = isChecked(checks, itemId, date);
    const without = (list: ChecklistCheck[]) => list.filter((c) => !(c.item_id === itemId && c.checked_date === date));
    const show = (checked: boolean) =>
      setChecks((prev) => (checked ? [...without(prev), { item_id: itemId, checked_date: date }] : without(prev)));

    show(!wasChecked);
    const { error: writeError } = wasChecked
      ? await supabase.from('checklist_checks').delete().eq('item_id', itemId).eq('checked_date', date)
      : await supabase
          .from('checklist_checks')
          .upsert({ item_id: itemId, user_id: user.id, checked_date: date }, { onConflict: 'item_id,checked_date', ignoreDuplicates: true });
    if (writeError) {
      console.error('Error saving tick:', writeError);
      show(wasChecked);
      failed('Could not save that tick. Please try again.');
    }
  };

  const saveItem = async (values: ChecklistItemValues, id?: string) => {
    if (!user) return false;
    const nextPosition = items.reduce((max, i) => Math.max(max, i.position), -1) + 1;
    const { data, error: writeError } = id
      ? await supabase.from('checklist_items').update(values).eq('id', id).select().single()
      : await supabase.from('checklist_items').insert({ ...values, user_id: user.id, position: nextPosition }).select().single();
    if (writeError || !data) {
      console.error('Error saving checklist item:', writeError);
      failed('Could not save the item. Please try again.');
      return false;
    }
    setItems((prev) => (id ? prev.map((i) => (i.id === id ? data : i)) : [...prev, data]));
    return true;
  };

  const archiveItem = async (id: string) => {
    const { data, error: writeError } = await supabase
      .from('checklist_items')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (writeError || !data) {
      console.error('Error archiving checklist item:', writeError);
      failed('Could not archive the item. Please try again.');
      return false;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
    return true;
  };

  return { items, checks, loading, error, toggle, saveItem, archiveItem };
};
