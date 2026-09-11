import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

type MealTime = 'breakfast' | 'lunch' | 'snack' | 'dinner';
const MEAL_ORDER: MealTime[] = ['breakfast', 'lunch', 'snack', 'dinner'];
const MEAL_LABEL: Record<MealTime, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
};

interface ChatMealItem {
  name: string;
  mealTime: MealTime;
  grams: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  vitaminC: number;
  vitaminD: number;
  vitaminB12: number;
  iron: number;
  calcium: number;
  potassium: number;
  sodium: number;
  magnesium: number;
  zinc: number;
}

interface ChatMsg {
  id: string;
  who: 'bot' | 'user' | 'q';
  text: string;
  replies?: string[];
}

const MICRO = [
  { key: 'vitaminC', label: 'Vit C', unit: 'mg', goal: 90, dot: 'bg-chart-vitc', text: 'text-chart-vitc' },
  { key: 'vitaminD', label: 'Vit D', unit: 'µg', goal: 15, dot: 'bg-chart-vitd', text: 'text-chart-vitd' },
  { key: 'vitaminB12', label: 'B12', unit: 'µg', goal: 2.4, dot: 'bg-chart-b12', text: 'text-chart-b12' },
  { key: 'iron', label: 'Iron', unit: 'mg', goal: 18, dot: 'bg-chart-iron', text: 'text-chart-iron' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', goal: 1000, dot: 'bg-chart-calcium', text: 'text-chart-calcium' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', goal: 3500, dot: 'bg-chart-potassium', text: 'text-chart-potassium' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', goal: 2300, cap: true, dot: 'bg-chart-sodium', text: 'text-chart-sodium' },
  { key: 'magnesium', label: 'Magnesium', unit: 'mg', goal: 400, dot: 'bg-chart-magnesium', text: 'text-chart-magnesium' },
  { key: 'zinc', label: 'Zinc', unit: 'mg', goal: 11, dot: 'bg-chart-zinc', text: 'text-chart-zinc' },
] as const satisfies readonly { key: keyof ChatMealItem; label: string; unit: string; goal: number; cap?: boolean; dot: string; text: string }[];

const GREETING = 'Tell me what you ate -- any meals, any order. I keep a tally and you tell me when you\'re done.';

const uid = () => Math.random().toString(36).slice(2, 10);

const fmt = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : Math.round(n * 10) / 10);

const ChatMealLog = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<ChatMsg[]>([{ id: 'm0', who: 'bot', text: GREETING }]);
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [screen, setScreen] = useState<'chat' | 'review'>('chat');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [openMicros, setOpenMicros] = useState<Record<number, boolean>>({});
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

  const toggleMicros = (idx: number) => setOpenMicros((p) => ({ ...p, [idx]: !p[idx] }));

  const grouped = MEAL_ORDER.map((mt) => ({
    mealTime: mt,
    items: items.map((it, idx) => ({ ...it, idx })).filter((it) => it.mealTime === mt),
  })).filter((g) => g.items.length > 0);

  const dayTotals = items.reduce(
    (acc, it) => {
      acc.calories += it.calories;
      acc.protein += it.protein;
      acc.carbs += it.carbs;
      acc.fat += it.fat;
      acc.fiber += it.fiber;
      MICRO.forEach((m) => {
        acc.micro[m.key] = (acc.micro[m.key] || 0) + (it[m.key] as number);
      });
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, micro: {} as Record<string, number> }
  );

  const handleAccept = async () => {
    if (!user || items.length === 0) return;
    setSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = items.map((it) => ({
        user_id: user.id,
        name: it.name,
        calories: it.calories,
        protein: it.protein,
        carbs: it.carbs,
        fat: it.fat,
        fiber: it.fiber,
        vitamin_c: it.vitaminC,
        vitamin_d: it.vitaminD,
        vitamin_b12: it.vitaminB12,
        iron: it.iron,
        calcium: it.calcium,
        potassium: it.potassium,
        sodium: it.sodium,
        magnesium: it.magnesium,
        zinc: it.zinc,
        meal_time: it.mealTime,
        logged_date: today,
      }));

      const { error } = await supabase.from('daily_meals').insert(rows);
      if (error) throw error;

      toast({
        title: 'Logged',
        description: `${items.length} item${items.length === 1 ? '' : 's'} across ${grouped.length} meal-time${grouped.length === 1 ? '' : 's'} added to today.`,
      });
      navigate('/');
    } catch (err) {
      console.error('Error logging chat meals:', err);
      toast({ title: 'Error', description: 'Failed to log meals. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (screen === 'review') {
    return (
      <div className="elevation-card space-y-4 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-semibold text-foreground">Review before logging</h2>
          <span className="text-[11px] text-muted-foreground">
            {grouped.length} meal-time{grouped.length === 1 ? '' : 's'} · {items.length} item{items.length === 1 ? '' : 's'}
          </span>
        </div>

        {grouped.map((g) => {
          const mealTotalCal = g.items.reduce((s, it) => s + it.calories, 0);
          return (
            <div key={g.mealTime} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-baseline justify-between bg-muted/50 px-3.5 py-2.5">
                <span className="text-sm font-semibold text-foreground">{MEAL_LABEL[g.mealTime]}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{Math.round(mealTotalCal)} kcal</span>
              </div>
              <div className="divide-y divide-border/60">
                {g.items.map((it) => (
                  <div key={it.idx} className="space-y-2 p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{it.name}</p>
                        <p className="text-[11px] text-muted-foreground">{it.grams} g</p>
                      </div>
                      <span className="font-mono text-sm font-medium tabular-nums text-foreground">{Math.round(it.calories)} kcal</span>
                    </div>
                    <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                      P {fmt(it.protein)} · C {fmt(it.carbs)} · F {fmt(it.fat)} · Fib {fmt(it.fiber)}
                    </p>
                    <button
                      type="button"
                      onClick={() => toggleMicros(it.idx)}
                      className="flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
                    >
                      <span>Micronutrients</span>
                      <span className="h-px flex-1 bg-border" />
                      {openMicros[it.idx] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>
                    {openMicros[it.idx] && (
                      <div className="grid grid-cols-3 gap-1.5">
                        {MICRO.map((m) => (
                          <div
                            key={m.key}
                            className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5"
                          >
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                              <span className="text-[9px] text-muted-foreground">{m.label}</span>
                            </div>
                            <span className="font-mono text-[10px] tabular-nums text-foreground">
                              {fmt(it[m.key] as number)} {m.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="elevation-card space-y-2 p-3.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Day totals</span>
            <span className="font-mono text-lg font-bold tabular-nums text-foreground">{Math.round(dayTotals.calories)} kcal</span>
          </div>
          <div className="grid grid-cols-4 gap-2 border-b border-border pb-3">
            {[
              { label: 'Protein', value: dayTotals.protein, dot: 'bg-chart-protein' },
              { label: 'Carbs', value: dayTotals.carbs, dot: 'bg-chart-carbs' },
              { label: 'Fat', value: dayTotals.fat, dot: 'bg-chart-fat' },
              { label: 'Fiber', value: dayTotals.fiber, dot: 'bg-chart-fiber' },
            ].map((row) => (
              <div key={row.label} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${row.dot}`} />
                  <span className="text-[10px] text-muted-foreground">{row.label}</span>
                </div>
                <span className="font-mono text-xs tabular-nums text-foreground">{fmt(row.value)}g</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1">
            {MICRO.map((m) => {
              const v = dayTotals.micro[m.key] || 0;
              const pct = Math.round((v / m.goal) * 100);
              return (
                <div key={m.key} className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 flex-none rounded-full ${m.dot}`} />
                  <span className="flex-1 truncate text-[10px] text-muted-foreground">{m.label}</span>
                  <span className={`font-mono text-[10px] tabular-nums ${m.text}`}>{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <Button onClick={handleAccept} disabled={saving} className="h-12 w-full gap-2 rounded-xl">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Logging...' : `Accept & log ${items.length} item${items.length === 1 ? '' : 's'} across ${grouped.length} meal-time${grouped.length === 1 ? '' : 's'}`}
          </Button>
          <Button variant="outline" onClick={() => setScreen('chat')} className="h-11 w-full rounded-xl text-sm">
            Something's off -- keep chatting
          </Button>
        </div>
      </div>
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
              Running tally · {Math.round(dayTotals.calories)} kcal
            </span>
            {summaryOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {summaryOpen && (
            <div className="space-y-1.5 border-t border-border px-3.5 py-2.5">
              {grouped.map((g) => (
                <div key={g.mealTime} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{MEAL_LABEL[g.mealTime]}</span>
                  <span className="font-mono tabular-nums text-foreground">
                    {Math.round(g.items.reduce((s, it) => s + it.calories, 0))} kcal
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
