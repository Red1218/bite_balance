import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { useSavedMeals, type SavedMeal } from '@/hooks/useSavedMeals';
import type { DailyMeal } from '@/hooks/useDailyMeals';
import MealReviewList, {
  ChatMealItem,
  MealTime,
  chatMealItemToRow,
  countMealTimes,
} from './MealReviewList';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface DescribeMealLogProps {
  defaultMealTime: MealTime;
}

const rowToItem = (row: DailyMeal): ChatMealItem => ({
  name: row.name,
  mealTime: row.meal_time as MealTime,
  grams: 0,
  calories: row.calories,
  protein: row.protein,
  carbs: row.carbs,
  fat: row.fat,
  fiber: row.fiber ?? 0,
  vitaminC: row.vitamin_c ?? 0,
  vitaminD: row.vitamin_d ?? 0,
  vitaminB12: row.vitamin_b12 ?? 0,
  iron: row.iron ?? 0,
  calcium: row.calcium ?? 0,
  potassium: row.potassium ?? 0,
  sodium: row.sodium ?? 0,
  magnesium: row.magnesium ?? 0,
  zinc: row.zinc ?? 0,
});

const savedMealToItem = (meal: SavedMeal, mealTime: MealTime): ChatMealItem => ({
  name: meal.name,
  mealTime,
  grams: 0,
  calories: meal.calories,
  protein: meal.protein,
  carbs: meal.carbs,
  fat: meal.fat,
  fiber: meal.fiber ?? 0,
  vitaminC: meal.vitamin_c ?? 0,
  vitaminD: meal.vitamin_d ?? 0,
  vitaminB12: meal.vitamin_b12 ?? 0,
  iron: meal.iron ?? 0,
  calcium: meal.calcium ?? 0,
  potassium: meal.potassium ?? 0,
  sodium: meal.sodium ?? 0,
  magnesium: meal.magnesium ?? 0,
  zinc: meal.zinc ?? 0,
});

const DescribeMealLog = ({ defaultMealTime }: DescribeMealLogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { closeAddMeal, notifyMealsLogged } = useAddMealSheet();
  const { meals: savedMeals } = useSavedMeals();

  const [draft, setDraft] = useState('');
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [screen, setScreen] = useState<'compose' | 'review'>('compose');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chipLoading, setChipLoading] = useState<'yesterday' | 'dinner' | 'most' | null>(null);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [banner, setBanner] = useState<{ text: string; options: string[] } | null>(null);

  const callChatMeal = async (nextHistory: ChatTurn[]) => {
    const { data, error } = await supabase.functions.invoke('chat-meal', {
      body: { messages: nextHistory, defaultMealTime },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data as { reply: string; replyOptions: string[]; items: ChatMealItem[] };
  };

  const handleBreakItDown = async () => {
    const trimmed = draft.trim();
    if (!trimmed || sending) return;
    setSending(true);
    const nextHistory: ChatTurn[] = [{ role: 'user', content: trimmed }];
    try {
      const data = await callChatMeal(nextHistory);
      setHistory([...nextHistory, { role: 'assistant', content: data.reply || '' }]);
      setItems(Array.isArray(data.items) ? data.items : []);
      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      setBanner(hasOptions ? { text: data.reply, options: data.replyOptions } : null);
      setScreen('review');
    } catch (err) {
      console.error('chat-meal error:', err);
      toast({
        title: 'Error',
        description: 'Could not process that. Try rephrasing, or add it manually instead.',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleBannerOption = async (option: string) => {
    setSending(true);
    const nextHistory: ChatTurn[] = [...history, { role: 'user', content: option }];
    try {
      const data = await callChatMeal(nextHistory);
      setHistory([...nextHistory, { role: 'assistant', content: data.reply || '' }]);
      setItems(Array.isArray(data.items) ? data.items : []);
      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      setBanner(hasOptions ? { text: data.reply, options: data.replyOptions } : null);
    } catch (err) {
      console.error('chat-meal error:', err);
      toast({ title: 'Error', description: 'Could not process that.', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleSameAsYesterday = async () => {
    if (!user) return;
    setChipLoading('yesterday');
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('logged_date', dateStr);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'Nothing found', description: 'No meals logged yesterday.' });
        return;
      }
      setBanner(null);
      setItems((data as DailyMeal[]).map(rowToItem));
      setScreen('review');
    } catch (err) {
      console.error("Failed to load yesterday's meals:", err);
      toast({ title: 'Error', description: "Failed to load yesterday's meals", variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handleRepeatLastDinner = async () => {
    if (!user) return;
    setChipLoading('dinner');
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .eq('meal_time', 'dinner')
        .lt('logged_date', today)
        .order('logged_date', { ascending: false })
        .order('logged_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!data || data.length === 0) {
        toast({ title: 'Nothing found', description: 'No past dinners logged yet.' });
        return;
      }
      const lastDate = (data as DailyMeal[])[0].logged_date;
      const rows = (data as DailyMeal[]).filter((r) => r.logged_date === lastDate);
      setBanner(null);
      setItems(rows.map((r) => ({ ...rowToItem(r), mealTime: defaultMealTime })));
      setScreen('review');
    } catch (err) {
      console.error('Failed to load last dinner:', err);
      toast({ title: 'Error', description: 'Failed to load last dinner', variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handleMostLogged = async () => {
    if (!user) return;
    setChipLoading('most');
    try {
      const { data, error } = await supabase
        .from('daily_meals')
        .select('*')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const rows = data as DailyMeal[] | null;
      if (!rows || rows.length === 0) {
        toast({ title: 'Nothing found', description: 'No meal history yet.' });
        return;
      }
      const counts = new Map<string, number>();
      rows.forEach((r) => counts.set(r.name, (counts.get(r.name) || 0) + 1));
      let topName = rows[0].name;
      let topCount = 0;
      counts.forEach((count, name) => {
        if (count > topCount) {
          topCount = count;
          topName = name;
        }
      });
      const mostRecent = rows.find((r) => r.name === topName)!;
      setBanner(null);
      setItems([{ ...rowToItem(mostRecent), mealTime: defaultMealTime }]);
      setScreen('review');
    } catch (err) {
      console.error('Failed to load most logged meal:', err);
      toast({ title: 'Error', description: 'Failed to load most logged meal', variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handlePickSavedMeal = (meal: SavedMeal) => {
    setBanner(null);
    setItems([savedMealToItem(meal, defaultMealTime)]);
    setScreen('review');
  };

  const handleAccept = async () => {
    if (!user || items.length === 0) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = items.map((it) => chatMealItemToRow(it, user.id, today));

      const { error } = await supabase.from('daily_meals').insert(rows);
      if (error) throw error;

      const mealTimeCount = countMealTimes(items);
      toast({
        title: 'Logged',
        description: `${items.length} item${items.length === 1 ? '' : 's'} across ${mealTimeCount} meal-time${mealTimeCount === 1 ? '' : 's'} added to today.`,
      });
      notifyMealsLogged();
      closeAddMeal();
    } catch (err) {
      console.error('Error logging described meals:', err);
      toast({ title: 'Error', description: 'Failed to log meals. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (screen === 'review') {
    return (
      <MealReviewList
        items={items}
        onAccept={handleAccept}
        onBack={() => {
          setScreen('compose');
          setBanner(null);
        }}
        backLabel="Edit description"
        saving={saving}
        banner={banner ? { text: banner.text, options: banner.options, onSelect: handleBannerOption } : undefined}
      />
    );
  }

  return (
    <div className="elevation-card flex flex-col gap-4 p-4">
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="e.g. grilled chicken sandwich, a banana and a black coffee for lunch"
        disabled={sending}
        rows={4}
        className="w-full resize-none rounded-xl border border-border bg-background/50 p-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />

      <div className="space-y-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Or start from</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSameAsYesterday}
            disabled={chipLoading !== null}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {chipLoading === 'yesterday' ? 'Loading...' : 'Same as yesterday'}
          </button>
          <button
            type="button"
            onClick={handleRepeatLastDinner}
            disabled={chipLoading !== null}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {chipLoading === 'dinner' ? 'Loading...' : 'Repeat last dinner'}
          </button>
          <button
            type="button"
            onClick={() => setShowSavedMeals((v) => !v)}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground"
          >
            From saved meals
          </button>
          <button
            type="button"
            onClick={handleMostLogged}
            disabled={chipLoading !== null}
            className="rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground disabled:opacity-50"
          >
            {chipLoading === 'most' ? 'Loading...' : 'Most logged'}
          </button>
        </div>
        {showSavedMeals && (
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
            {savedMeals.length === 0 && <p className="p-2 text-xs text-muted-foreground">No saved meals yet.</p>}
            {savedMeals.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => handlePickSavedMeal(meal)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-foreground hover:bg-accent"
              >
                <span>{meal.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{Math.round(meal.calories)} kcal</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        onClick={handleBreakItDown}
        disabled={sending || !draft.trim()}
        className="h-12 w-full gap-2 rounded-xl"
      >
        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {sending ? 'Breaking it down...' : 'Break it down'}
      </Button>
    </div>
  );
};

export default DescribeMealLog;
