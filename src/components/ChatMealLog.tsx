import { useEffect, useRef, useState } from 'react';
import { Send, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
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

interface ChatMealLogProps {
  defaultMealTime: MealTime;
}

const ChatMealLog = ({ defaultMealTime }: ChatMealLogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { closeAddMeal } = useAddMealSheet();

  const [messages, setMessages] = useState<ChatMsg[]>([{ id: 'm0', who: 'bot', text: GREETING }]);
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [screen, setScreen] = useState<'chat' | 'review'>('chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [saving, setSaving] = useState(false);
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
