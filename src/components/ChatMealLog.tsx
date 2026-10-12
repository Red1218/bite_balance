import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Sparkles, Mic, Plus, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { useSavedMeals, type SavedMeal } from '@/hooks/useSavedMeals';
import type { DailyMeal } from '@/hooks/useDailyMeals';
import { defaultSlotForNow } from '@/lib/mealTime';
import { cn, fmtLocalDate } from '@/lib/utils';
import MealReviewList, {
  ChatMealItem,
  MealTime,
  MEAL_ORDER,
  MEAL_LABEL,
  chatMealItemToRow,
} from './MealReviewList';

interface ChatMsg {
  id: string;
  who: 'bot' | 'user';
  text: string;
  createdAt: string;
  replies?: string[];
  /** A clean single-item correction ("Rice -> 200g -> 260g, +97 kcal") --
   * when set, this renders instead of `text`, matching the ledger's diff
   * line instead of a repetitive prose paragraph. */
  diff?: string;
}

const GREETING = "Tell me what you ate -- I'll tally it up, and you can log each meal right from here.";

// ponytail: naive recency cap, not real context summarization -- revisit if
// conversations regularly need older context than the last ~30 messages.
const CHAT_CONTEXT_LIMIT = 30;
const HISTORY_LOAD_LIMIT = 200;

const uid = () => Math.random().toString(36).slice(2, 10);

const toItem = (row: DailyMeal | SavedMeal, mealTime: MealTime, grams: number): ChatMealItem => ({
  name: row.name,
  mealTime,
  grams,
  calories: row.calories,
  protein: row.protein ?? 0,
  carbs: row.carbs ?? 0,
  fat: row.fat ?? 0,
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

const rowToItem = (row: DailyMeal) => toItem(row, row.meal_time as MealTime, row.grams ?? 0);

// If exactly one item changed grams/calories between turns and nothing else
// about the list's shape moved, render it as a diff line instead of prose.
// ponytail: order+name+mealTime match is a naive correction heuristic, not
// real diffing -- any bigger change (added/removed/reordered items) just
// falls back to the model's own text, which is always safe.
const computeSingleDiff = (prev: ChatMealItem[], next: ChatMealItem[]): string | null => {
  if (prev.length !== next.length || prev.length === 0) return null;
  const changed: { name: string; prevGrams: number; nextGrams: number; deltaKcal: number }[] = [];
  for (let i = 0; i < next.length; i++) {
    const p = prev[i];
    const n = next[i];
    if (p.name.toLowerCase() !== n.name.toLowerCase() || p.mealTime !== n.mealTime) return null;
    if (p.grams !== n.grams || Math.round(p.calories) !== Math.round(n.calories)) {
      changed.push({ name: n.name, prevGrams: p.grams, nextGrams: n.grams, deltaKcal: Math.round(n.calories - p.calories) });
    }
  }
  if (changed.length !== 1) return null;
  const c = changed[0];
  const sign = c.deltaKcal >= 0 ? '+' : '';
  return `${c.name} → ${c.prevGrams}g → ${c.nextGrams}g, ${sign}${c.deltaKcal} kcal`;
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

// Renders the model's prose reply: a blank line starts a new block, a single
// newline a new line inside it, and **text** is emphasised. Anything else
// (older plain-text messages included) shows as-is.
const Prose = ({ text }: { text: string }) => (
  <div className="space-y-3 text-sm leading-relaxed tabular-nums text-foreground/90">
    {text.split(/\n{2,}/).map((block, bi) => (
      <div key={bi} className="space-y-2">
        {block.split('\n').map((line, li) => (
          <p key={li}>
            {line.split(/(\*\*[^*]+\*\*)/).map((part, pi) =>
              part.length > 4 && part.startsWith('**') && part.endsWith('**') ? (
                <span key={pi} className="font-semibold text-foreground">
                  {part.slice(2, -2)}
                </span>
              ) : (
                part
              )
            )}
          </p>
        ))}
      </div>
    ))}
  </div>
);

interface ChatMealLogProps {
  calorieGoal: number;
  /** kcal already saved to today's log -- lets the model say what's left of the day. */
  loggedKcal: number;
}

const ChatMealLog = ({ calorieGoal, loggedKcal }: ChatMealLogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { notifyMealsLogged } = useAddMealSheet();
  const { meals: savedMeals } = useSavedMeals();
  const [searchParams, setSearchParams] = useSearchParams();
  // Present only when opened from a Conversations row -- a read-only view
  // of that single day's messages, with no composer and no pending tally.
  const viewDate = searchParams.get('date');

  const [messages, setMessages] = useState<ChatMsg[]>([
    { id: 'm0', who: 'bot', text: GREETING, createdAt: new Date().toISOString() },
  ]);
  const [items, setItems] = useState<ChatMealItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [logging, setLogging] = useState(false);
  const [chipLoading, setChipLoading] = useState<'yesterday' | 'dinner' | 'most' | null>(null);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Each transcript is appended to whatever is already typed, so the user can
  // dictate in several goes and still edit before sending.
  const voice = useVoiceRecorder((text) =>
    setDraft((d) => (d.trim() ? `${d.trim()} ${text}` : text))
  );
  const voiceClock = `${Math.floor(voice.seconds / 60)}:${String(voice.seconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending, items.length]);

  // Load persisted conversation history once, on mount -- an empty history
  // keeps the local GREETING (never persisted, it's just a canned opener).
  // Opened with ?date=YYYY-MM-DD instead, load only that day's messages.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const query = supabase.from('chat_messages').select('*').eq('user_id', user.id);
      const { data, error } = viewDate
        ? await query
            // viewDate is a local calendar day -- query its local-midnight bounds
            .gte('created_at', new Date(`${viewDate}T00:00:00`).toISOString())
            .lt('created_at', new Date(new Date(`${viewDate}T00:00:00`).getTime() + 86_400_000).toISOString())
            .order('created_at', { ascending: true })
        : await query.order('created_at', { ascending: true }).limit(HISTORY_LOAD_LIMIT);
      if (error) {
        console.error('Error loading chat history:', error);
        return;
      }
      if (viewDate || (data && data.length > 0)) {
        setMessages(
          (data ?? []).map((row) => ({
            id: row.id,
            who: row.role === 'user' ? 'user' : 'bot',
            text: row.content,
            createdAt: row.created_at,
          }))
        );
      }
    })();
  }, [user, viewDate]);

  const persistMessage = async (role: 'user' | 'assistant', content: string) => {
    if (!user) return;
    const { error } = await supabase.from('chat_messages').insert({ user_id: user.id, role, content });
    if (error) console.error('Error persisting chat message:', error);
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const now = new Date().toISOString();
    const nextMessages: ChatMsg[] = [...messages, { id: uid(), who: 'user', text: trimmed, createdAt: now }];
    setMessages(nextMessages);
    setDraft('');
    void persistMessage('user', trimmed);

    setSending(true);
    try {
      const todayStr = fmtLocalDate(new Date(now));
      const contextMessages = nextMessages.slice(-CHAT_CONTEXT_LIMIT);
      const { data, error } = await supabase.functions.invoke('chat-meal', {
        body: {
          // Old-day messages are tagged so the model can still recall and
          // discuss them, without mistaking them for part of today's tally.
          messages: contextMessages.map((m) => {
            const msgDay = fmtLocalDate(new Date(m.createdAt));
            return {
              role: m.who === 'user' ? 'user' : 'assistant',
              content: msgDay === todayStr ? m.text : `[${msgDay}] ${m.text}`,
            };
          }),
          defaultMealTime: defaultSlotForNow(),
          today: todayStr,
          calorieGoal,
          loggedKcal,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const hasOptions = Array.isArray(data.replyOptions) && data.replyOptions.length > 0;
      const diff = Array.isArray(data.items) ? computeSingleDiff(items, data.items) : null;
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          who: 'bot',
          text: data.reply,
          diff: diff || undefined,
          replies: hasOptions ? data.replyOptions : undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
      void persistMessage('assistant', data.reply);
      if (Array.isArray(data.items)) setItems(data.items);
    } catch (err) {
      console.error('chat-meal error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          who: 'bot',
          text: 'Could not process that. Try rephrasing, or add it manually instead.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const runChip = async (key: NonNullable<typeof chipLoading>, errorMessage: string, fn: () => Promise<void>) => {
    setChipLoading(key);
    try {
      await fn();
    } catch (err) {
      console.error(`${errorMessage}:`, err);
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handleSameAsYesterday = async () => {
    if (!user) return;
    await runChip('yesterday', "Failed to load yesterday's meals", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = fmtLocalDate(yesterday);
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
      setItems((prev) => [...prev, ...(data as DailyMeal[]).map(rowToItem)]);
    });
  };

  const handleRepeatLastDinner = async () => {
    if (!user) return;
    await runChip('dinner', 'Failed to load last dinner', async () => {
      const today = fmtLocalDate(new Date());
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
      setItems((prev) => [...prev, ...rows.map((r) => ({ ...rowToItem(r), mealTime: defaultSlotForNow() }))]);
    });
  };

  const handleMostLogged = async () => {
    if (!user) return;
    await runChip('most', 'Failed to load most logged meal', async () => {
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
      setItems((prev) => [...prev, { ...rowToItem(mostRecent), mealTime: defaultSlotForNow() }]);
    });
  };

  const handlePickSavedMeal = (meal: SavedMeal) => {
    setItems((prev) => [...prev, toItem(meal, defaultSlotForNow(), 0)]);
  };

  const handleChangeMealTime = (idx: number, mealTime: MealTime) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, mealTime } : it)));
  };

  // Logs every open item in one insert. One "Logged <meal-time> · ..." message
  // per meal-time still goes into the thread: chat-meal reads those to know
  // which meal-times are done and must not be restated.
  const handleLogAll = async () => {
    if (!user || items.length === 0) return;

    setLogging(true);
    try {
      const today = fmtLocalDate(new Date());
      const rows = items.map((it) => chatMealItemToRow(it, user.id, today));

      const { error } = await supabase.from('daily_meals').insert(rows);
      if (error) throw error;

      const confirmations = MEAL_ORDER.filter((mt) => items.some((it) => it.mealTime === mt)).map((mt) => {
        const group = items.filter((it) => it.mealTime === mt);
        const kcal = Math.round(group.reduce((s, it) => s + it.calories, 0));
        return `Logged ${MEAL_LABEL[mt].toLowerCase()} · ${group.length} item${group.length === 1 ? '' : 's'} · ${kcal} kcal.`;
      });
      const totalKcal = Math.round(items.reduce((s, it) => s + it.calories, 0));
      toast({
        title: 'Logged',
        description: `${items.length} item${items.length === 1 ? '' : 's'} · ${totalKcal} kcal`,
      });
      notifyMealsLogged();

      setItems([]);
      setEditing(false);
      const at = new Date().toISOString();
      setMessages((prev) => [...prev, ...confirmations.map((text) => ({ id: uid(), who: 'bot' as const, text, createdAt: at }))]);
      // Sequential so the thread reloads in the same order.
      for (const text of confirmations) await persistMessage('assistant', text);
    } catch (err) {
      console.error('Error logging meals:', err);
      toast({ title: 'Error', description: 'Failed to log meals. Please try again.', variant: 'destructive' });
    } finally {
      setLogging(false);
    }
  };

  if (editing) {
    return (
      <MealReviewList
        items={items}
        onAccept={handleLogAll}
        onBack={() => setEditing(false)}
        onChangeMealTime={handleChangeMealTime}
        backLabel="Back to chat"
        saving={logging}
      />
    );
  }

  const isFreshConversation = !viewDate && messages.length === 1;
  const threadDay = viewDate ?? fmtLocalDate(new Date());
  const firstUserMsg = messages.find((m) => m.who === 'user' && fmtLocalDate(new Date(m.createdAt)) === threadDay);
  const title = firstUserMsg ? truncate(firstUserMsg.text, 40) : 'New conversation';
  const subtitle = viewDate
    ? new Date(`${viewDate}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    : `${loggedKcal.toLocaleString()} kcal logged`;

  return (
    <div className="flex flex-col gap-4">
      {/* The page scrolls (not an inner box), so cover the status-bar strip and pin the header,
          otherwise older messages slide up under the clock. */}
      <div className="fixed inset-x-0 top-0 z-40 bg-background" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div
        className="sticky z-30 -mx-4 flex items-center gap-2.5 border-b border-border bg-background px-4 pb-3 pt-2"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-primary/28 bg-primary/12">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-sm font-medium leading-tight text-foreground">{title}</h1>
          <p className="font-mono text-[10px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      {viewDate && (
        <button
          type="button"
          onClick={() => setSearchParams({})}
          className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to today
        </button>
      )}

      <div className="flex flex-col gap-[18px]">
        {messages.map((m) =>
          m.who === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[84%] whitespace-pre-wrap rounded-[20px] bg-muted px-[15px] py-3 text-sm leading-normal text-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={m.id} className="space-y-3">
              {m.diff ? (
                <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5">
                  <span className="flex-1 font-mono text-xs text-muted-foreground">{m.diff.split(/(→)/).map((part, i) => part === '→' ? <span key={i} className="mx-1 text-muted-foreground/60">{part}</span> : part)}</span>
                </div>
              ) : (
                <Prose text={m.text} />
              )}
              {m.replies && m.replies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {m.replies.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => send(r)}
                      className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}
        {sending && (
          <div className="flex items-center gap-1 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        )}
      </div>

      {isFreshConversation && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Or start from</span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'yesterday', label: 'Same as yesterday', onClick: handleSameAsYesterday },
                { key: 'dinner', label: 'Repeat last dinner', onClick: handleRepeatLastDinner },
                { key: null, label: 'From saved meals', onClick: () => setShowSavedMeals((v) => !v) },
                { key: 'most', label: 'Most logged', onClick: handleMostLogged },
              ] as const
            ).map(({ key, label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                disabled={key !== null && chipLoading !== null}
                className={cn(
                  'rounded-full border border-border bg-muted px-3.5 py-2 text-xs font-medium text-foreground',
                  key && 'disabled:opacity-50'
                )}
              >
                {key && chipLoading === key ? 'Loading...' : label}
              </button>
            ))}
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

      {items.length > 0 && !sending && (
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={handleLogAll}
            disabled={logging}
            className="flex h-[38px] items-center gap-[7px] rounded-[11px] bg-primary px-[15px] text-[13px] font-semibold text-primary-foreground shadow-[0_8px_18px_-10px_hsl(var(--primary)/0.8)] disabled:opacity-60"
          >
            {logging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            {logging ? 'Logging...' : `Log these ${items.length}`}
          </button>
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={logging}
            className="text-[13px] font-medium text-muted-foreground disabled:opacity-60"
          >
            Edit amounts
          </button>
        </div>
      )}

      {/* scroll-mb keeps the newest reply clear of the docked composer + bottom nav */}
      <div ref={bottomRef} className="scroll-mb-56" />

      {viewDate ? null : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(draft);
          }}
          className="sticky z-30 -mx-4 space-y-2 px-4 pb-3 pt-4"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)',
            background: 'linear-gradient(to top, hsl(var(--background)) 70%, hsl(var(--background) / 0))',
          }}
        >
          {voice.state !== 'idle' && (
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              <span className="text-[11px] font-medium text-destructive">
                {voice.state === 'recording' ? `Recording ${voiceClock}` : 'Transcribing…'}
              </span>
            </div>
          )}
          <div className="flex min-h-12 items-center gap-1.5 rounded-full bg-muted pl-4 pr-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What did you eat?"
              disabled={sending}
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void voice.toggle()}
              disabled={sending || voice.state === 'transcribing'}
              aria-label={voice.state === 'recording' ? 'Stop recording' : 'Record voice'}
              className={cn(
                'flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full text-muted-foreground disabled:opacity-50',
                voice.state === 'recording' && 'animate-pulse bg-primary/10 text-primary'
              )}
            >
              {voice.state === 'transcribing' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </button>
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              aria-label="Send"
              className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default ChatMealLog;
