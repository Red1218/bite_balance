import { useEffect, useRef, useState } from 'react';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
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
  MEAL_ORDER,
  MEAL_LABEL,
  chatMealItemToRow,
  countMealTimes,
} from './MealReviewList';

interface ChatMsg {
  id: string;
  who: 'bot' | 'user' | 'q';
  text: string;
  replies?: string[];
}

const GREETING = 'Tell me what you ate -- any meals, any order. I keep a tally and you tell me when you\'re done.';

const uid = () => Math.random().toString(36).slice(2, 10);

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

interface ChatMealLogProps {
  defaultMealTime: MealTime;
}

const ChatMealLog = ({ defaultMealTime }: ChatMealLogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { closeAddMeal, notifyMealsLogged } = useAddMealSheet();
  const { meals: savedMeals } = useSavedMeals();

  const [messages, setMessages] = useState<ChatMsg[]>([{ id: 'm0', who: 'bot', text: GREETING }]);
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [screen, setScreen] = useState<'chat' | 'review'>('chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [chipLoading, setChipLoading] = useState<'yesterday' | 'dinner' | 'most' | null>(null);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const nextMessages: ChatMsg[] = [...messages, { id: uid(), who: 'user', text: trimmed }];
    setMessages(nextMessages);
    setDraft('');

    if ((trimmed.toLowerCase() === 'done' || trimmed.toLowerCase() === 'finish') && items.length > 0) {
      setScreen('review');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('chat-meal', {
        body: {
          messages: nextMessages.map((m) => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text })),
          defaultMealTime,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      setMessages((prev) => [
        ...prev,
        hasOptions
          ? { id: uid(), who: 'q', text: data.reply, replies: data.replyOptions }
          : { id: uid(), who: 'bot', text: data.reply },
      ]);
      if (Array.isArray(data.items)) setItems(data.items);
    } catch (err) {
      console.error('chat-meal error:', err);
      setMessages((prev) => [
        ...prev,
        { id: uid(), who: 'bot', text: 'Could not process that. Try rephrasing, or add it manually instead.' },
      ]);
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
    setItems([savedMealToItem(meal, defaultMealTime)]);
    setScreen('review');
  };

  const dayCalories = Math.round(items.reduce((s, it) => s + it.calories, 0));
  const groupedForTally = MEAL_ORDER.map((mt) => ({
    mealTime: mt,
    calories: items.filter((it) => it.mealTime === mt).reduce((s, it) => s + it.calories, 0),
  })).filter((g) => g.calories > 0);

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
      console.error('Error logging chat meals:', err);
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
        onBack={() => setScreen('chat')}
        backLabel="Something's off -- keep chatting"
        saving={saving}
      />
    );
  }

  const isFreshConversation = messages.length === 1;

  return (
    <div className="elevation-card flex flex-col gap-3 p-4">
      <div ref={scrollRef} className="flex max-h-[420px] flex-col gap-2.5 overflow-y-auto pr-1">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.who === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-[85%] space-y-2">
              <div
                className={
                  m.who === 'user'
                    ? 'rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2.5 text-sm text-primary-foreground'
                    : m.who === 'q'
                      ? 'rounded-2xl rounded-tl-sm border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-sm text-foreground'
                      : 'rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5 text-sm text-foreground'
                }
              >
                {m.text}
              </div>
              {m.who === 'q' && m.replies && (
                <div className="flex flex-wrap gap-1.5">
                  {m.replies.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => send(r)}
                      className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {isFreshConversation && (
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
      )}

      {items.length > 0 && (
        <div className="rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setSummaryOpen((v) => !v)}
            className="flex w-full items-center justify-between px-3.5 py-2.5"
          >
            <span className="text-xs font-semibold text-foreground">
              Running tally · {dayCalories} kcal
            </span>
            {summaryOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {summaryOpen && (
            <div className="space-y-1.5 border-t border-border px-3.5 py-2.5">
              {groupedForTally.map((g) => (
                <div key={g.mealTime} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{MEAL_LABEL[g.mealTime]}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {Math.round(g.calories)} kcal
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. 2 chapati and dal for dinner"
          disabled={sending}
          className="h-11 flex-1 rounded-xl border border-border bg-background/50 px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()} className="h-11 w-11 flex-none rounded-xl">
          <Send className="h-4 w-4" />
        </Button>
      </form>

      {items.length > 0 && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setScreen('review')}
          className="h-10 w-full rounded-xl text-sm"
        >
          Finish -- review {items.length} item{items.length === 1 ? '' : 's'}
        </Button>
      )}
    </div>
  );
};

export default ChatMealLog;
