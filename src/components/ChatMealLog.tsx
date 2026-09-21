import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Sparkles, Mic, Plus, Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import { useSavedMeals, type SavedMeal } from '@/hooks/useSavedMeals';
import type { DailyMeal } from '@/hooks/useDailyMeals';
import { defaultSlotForNow } from '@/lib/mealTime';
import { cn } from '@/lib/utils';
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

const rowToItem = (row: DailyMeal): ChatMealItem => ({
  name: row.name,
  mealTime: row.meal_time as MealTime,
  grams: row.grams ?? 0,
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

const ChatMealLog = () => {
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
  const [editingMealTime, setEditingMealTime] = useState<MealTime | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loggingMealTime, setLoggingMealTime] = useState<MealTime | null>(null);
  const [chipLoading, setChipLoading] = useState<'yesterday' | 'dinner' | 'most' | null>(null);
  const [showSavedMeals, setShowSavedMeals] = useState(false);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Android's native recognizer ends its listening session as soon as it
  // detects a pause in speech (mid-sentence, not just when the user is done)
  // -- these refs let the 'stopped' handler tell an intentional stop from a
  // pause and, for a pause, silently start a new session so dictation reads
  // as continuous instead of cutting off at the first breath.
  const dictatingRef = useRef(false);
  const draftRef = useRef('');
  const committedTextRef = useRef('');
  // The native recognizer funnels its session-final transcript (onResults)
  // through the SAME 'partialResults' event used for growing interim
  // hypotheses (see SpeechRecognitionListener#onResults in the plugin's
  // Android source) -- so after we commit draftRef into committedTextRef on
  // 'stopped', that same session's late final result arrives right after and
  // gets appended a second time, duplicating every word. Drop any
  // 'partialResults' event that isn't from an actually-started session.
  const ignorePartialRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    const partialHandle = SpeechRecognition.addListener('partialResults', (data) => {
      if (ignorePartialRef.current) return;
      if (data.matches && data.matches.length > 0) {
        const latest = data.matches[0];
        setDraft(committedTextRef.current ? `${committedTextRef.current} ${latest}` : latest);
      }
    });
    const listeningHandle = SpeechRecognition.addListener('listeningState', (data) => {
      if (data.status === 'started') {
        ignorePartialRef.current = false;
        setListening(true);
        return;
      }
      // Every 'stopped' -- restart or real stop -- is followed by that
      // session's late final result on the same event; ignore partials until
      // the next session's own 'started' proves they're fresh.
      ignorePartialRef.current = true;
      if (dictatingRef.current) {
        committedTextRef.current = draftRef.current;
        // ponytail: the native recognizer's teardown of the previous session
        // is an OS-level async race we don't control -- any fixed delay is a
        // guess, and logcat confirms 400ms alone still loses sometimes
        // ("Client has opened 2 sessions" -> cancel-without-start -> restart
        // fails and the mic silently shuts off). One retry after a longer
        // gap absorbs that instead of surfacing it as a dead mic.
        const attemptRestart = (delayMs: number, isRetry: boolean) => {
          setTimeout(() => {
            if (!dictatingRef.current) return;
            SpeechRecognition.start({ popup: false, partialResults: true, language: 'en-US' }).catch((err) => {
              console.error('Speech recognition restart error:', err);
              if (!isRetry) {
                attemptRestart(700, true);
                return;
              }
              dictatingRef.current = false;
              setListening(false);
            });
          }, delayMs);
        };
        attemptRestart(400, false);
      } else {
        setListening(false);
      }
    });
    return () => {
      void partialHandle.then((h) => h.remove());
      void listeningHandle.then((h) => h.remove());
    };
  }, []);

  const handleMicToggle = async () => {
    if (listening) {
      dictatingRef.current = false;
      ignorePartialRef.current = true;
      // Don't await: the plugin's native stop() never resolves its call on
      // success (only rejects on error), so awaiting it hangs forever and
      // the UI never leaves "listening" until the page remounts. The native
      // mic stops immediately regardless; update our own state right away.
      void SpeechRecognition.stop().catch(() => {});
      setListening(false);
      return;
    }

    const { available } = await SpeechRecognition.available();
    if (!available) {
      toast({ title: 'Not available', description: 'Speech recognition is not available on this device.', variant: 'destructive' });
      return;
    }

    let { speechRecognition } = await SpeechRecognition.checkPermissions();
    if (speechRecognition !== 'granted') {
      ({ speechRecognition } = await SpeechRecognition.requestPermissions());
    }
    if (speechRecognition !== 'granted') {
      toast({ title: 'Microphone permission needed', description: 'Allow microphone access to use speech-to-text.', variant: 'destructive' });
      return;
    }

    committedTextRef.current = '';
    dictatingRef.current = true;
    setListening(true);
    try {
      await SpeechRecognition.start({ popup: false, partialResults: true, language: 'en-US' });
    } catch (err) {
      console.error('Speech recognition error:', err);
      dictatingRef.current = false;
      setListening(false);
    }
  };

  // Load persisted conversation history once, on mount -- an empty history
  // keeps the local GREETING (never persisted, it's just a canned opener).
  // Opened with ?date=YYYY-MM-DD instead, load only that day's messages.
  useEffect(() => {
    if (!user) return;
    (async () => {
      const query = supabase.from('chat_messages').select('*').eq('user_id', user.id);
      const { data, error } = viewDate
        ? await query
            .gte('created_at', `${viewDate}T00:00:00.000Z`)
            .lt('created_at', `${viewDate}T23:59:59.999Z`)
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
      const todayStr = now.split('T')[0];
      const contextMessages = nextMessages.slice(-CHAT_CONTEXT_LIMIT);
      const { data, error } = await supabase.functions.invoke('chat-meal', {
        body: {
          // Old-day messages are tagged so the model can still recall and
          // discuss them, without mistaking them for part of today's tally.
          messages: contextMessages.map((m) => {
            const msgDay = m.createdAt.split('T')[0];
            return {
              role: m.who === 'user' ? 'user' : 'assistant',
              content: msgDay === todayStr ? m.text : `[${msgDay}] ${m.text}`,
            };
          }),
          defaultMealTime: defaultSlotForNow(),
          today: todayStr,
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
      setItems((prev) => [...prev, ...(data as DailyMeal[]).map(rowToItem)]);
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
      setItems((prev) => [...prev, ...rows.map((r) => ({ ...rowToItem(r), mealTime: defaultSlotForNow() }))]);
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
      setItems((prev) => [...prev, { ...rowToItem(mostRecent), mealTime: defaultSlotForNow() }]);
    } catch (err) {
      console.error('Failed to load most logged meal:', err);
      toast({ title: 'Error', description: 'Failed to load most logged meal', variant: 'destructive' });
    } finally {
      setChipLoading(null);
    }
  };

  const handlePickSavedMeal = (meal: SavedMeal) => {
    setItems((prev) => [...prev, savedMealToItem(meal, defaultSlotForNow())]);
  };

  const handleChangeMealTime = (idx: number, mealTime: MealTime) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, mealTime } : it)));
  };

  const handleLogGroup = async (mealTime: MealTime) => {
    if (!user) return;
    const groupItems = items.filter((it) => it.mealTime === mealTime);
    if (groupItems.length === 0) return;

    setLoggingMealTime(mealTime);
    try {
      const today = new Date().toISOString().split('T')[0];
      const rows = groupItems.map((it) => chatMealItemToRow(it, user.id, today));

      const { error } = await supabase.from('daily_meals').insert(rows);
      if (error) throw error;

      const totalKcal = Math.round(groupItems.reduce((s, it) => s + it.calories, 0));
      const confirmationText = `Logged ${MEAL_LABEL[mealTime].toLowerCase()} · ${groupItems.length} item${groupItems.length === 1 ? '' : 's'} · ${totalKcal} kcal.`;
      toast({ title: 'Logged', description: confirmationText });
      notifyMealsLogged();

      setItems((prev) => prev.filter((it) => it.mealTime !== mealTime));
      setEditingMealTime((cur) => (cur === mealTime ? null : cur));
      setMessages((prev) => [
        ...prev,
        { id: uid(), who: 'bot', text: confirmationText, createdAt: new Date().toISOString() },
      ]);
      void persistMessage('assistant', confirmationText);
    } catch (err) {
      console.error('Error logging meal group:', err);
      toast({ title: 'Error', description: 'Failed to log meal. Please try again.', variant: 'destructive' });
    } finally {
      setLoggingMealTime(null);
    }
  };

  if (editingMealTime) {
    return (
      <MealReviewList
        items={items}
        onlyMealTime={editingMealTime}
        onAccept={() => handleLogGroup(editingMealTime)}
        onBack={() => setEditingMealTime(null)}
        onChangeMealTime={handleChangeMealTime}
        backLabel="Back to chat"
        saving={loggingMealTime === editingMealTime}
      />
    );
  }

  const isFreshConversation = !viewDate && messages.length === 1;
  const pendingMealTimes = MEAL_ORDER.filter((mt) => items.some((it) => it.mealTime === mt));

  return (
    <div className="flex flex-col gap-4">
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

      <div ref={scrollRef} className="relative max-h-[55vh] overflow-y-auto pr-1">
        <div className="pointer-events-none absolute bottom-0 left-[13px] top-0 w-px bg-gradient-to-b from-border to-transparent" />
        <div className="flex flex-col gap-3.5">
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-3">
              <div className="flex w-[26px] flex-none justify-center pt-1">
                {m.who === 'user' ? (
                  <span className="h-[7px] w-[7px] rounded-full border border-border bg-muted-foreground/30" />
                ) : (
                  <span className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border border-primary/50 bg-background">
                    <Sparkles className="h-2.5 w-2.5 text-primary" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                {m.who === 'user' && (
                  <div className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground/60">
                    {new Date(m.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                  </div>
                )}
                {m.diff ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-2.5">
                    <span className="flex-1 font-mono text-xs text-muted-foreground">{m.diff.split(/(→)/).map((part, i) => part === '→' ? <span key={i} className="mx-1 text-muted-foreground/60">{part}</span> : part)}</span>
                  </div>
                ) : (
                  <p className={cn('text-sm leading-relaxed', m.who === 'user' ? 'text-muted-foreground' : 'text-foreground')}>
                    {m.text}
                  </p>
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
            </div>
          ))}
          {sending && (
            <div className="flex items-start gap-3">
              <div className="flex w-[26px] flex-none justify-center pt-1">
                <span className="flex h-[15px] w-[15px] flex-none items-center justify-center rounded-full border border-primary/50 bg-background">
                  <Sparkles className="h-2.5 w-2.5 text-primary" />
                </span>
              </div>
              <div className="flex items-center gap-1 pt-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
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

      {pendingMealTimes.map((mt) => {
        const groupItems = items.filter((it) => it.mealTime === mt);
        const totalKcal = Math.round(groupItems.reduce((s, it) => s + it.calories, 0));
        const totalGrams = Math.round(groupItems.reduce((s, it) => s + (it.grams || 0), 0));
        const isLogging = loggingMealTime === mt;
        return (
          <div key={mt} className="ml-[38px] overflow-hidden rounded-2xl border border-border bg-muted/30">
            <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex-none rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary">
                  {MEAL_LABEL[mt]}
                </span>
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {groupItems.length} item{groupItems.length === 1 ? '' : 's'}{totalGrams > 0 ? ` · ${totalGrams} g` : ''}
                </span>
              </div>
              <div className="flex flex-none items-baseline gap-1">
                <span className="font-mono text-lg font-semibold tabular-nums text-foreground">{totalKcal}</span>
                <span className="font-mono text-[10px] text-muted-foreground">kcal</span>
              </div>
            </div>
            <div className="divide-y divide-border">
              {groupItems.map((it, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setEditingMealTime(mt)}
                  disabled={loggingMealTime !== null}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left disabled:opacity-60"
                >
                  <div className="flex min-w-[46px] flex-none items-center justify-center gap-0.5 rounded-lg border border-border bg-background px-1.5 py-1">
                    <span className="font-mono text-xs font-semibold tabular-nums text-foreground">{Math.round(it.grams)}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">g</span>
                  </div>
                  <span className="flex-1 truncate text-sm text-foreground">{it.name}</span>
                  <span className="flex-none font-mono text-xs tabular-nums text-muted-foreground">{Math.round(it.calories)}</span>
                  <ChevronRight className="h-3.5 w-3.5 flex-none text-muted-foreground/50" />
                </button>
              ))}
            </div>
            <div className="flex gap-2 p-3">
              <button
                type="button"
                onClick={() => handleLogGroup(mt)}
                disabled={loggingMealTime !== null}
                className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground disabled:opacity-60"
              >
                {isLogging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                {isLogging ? 'Logging...' : `Log ${MEAL_LABEL[mt].toLowerCase()}`}
              </button>
              <button
                type="button"
                onClick={() => setEditingMealTime(mt)}
                disabled={loggingMealTime !== null}
                className="h-10 flex-none rounded-xl border border-border px-4 text-xs font-medium text-foreground disabled:opacity-60"
              >
                Edit
              </button>
            </div>
          </div>
        );
      })}

      {viewDate ? null : (
        <>
          {listening && (
            <div className="flex items-center gap-1.5 px-1">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-destructive" />
              <span className="text-[11px] font-medium text-destructive">Listening…</span>
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
              placeholder="Tell me what you ate..."
              disabled={sending}
              className="h-12 flex-1 rounded-2xl border border-border bg-muted/40 px-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleMicToggle}
              disabled={sending}
              className={cn(
                'h-12 w-12 flex-none rounded-2xl border-border bg-muted/40',
                listening && 'border-primary/40 bg-primary/10 text-primary animate-pulse'
              )}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button type="submit" size="icon" disabled={sending || !draft.trim()} className="h-12 w-12 flex-none rounded-2xl">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </>
      )}
    </div>
  );
};

export default ChatMealLog;
