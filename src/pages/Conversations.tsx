import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MessagesSquare, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface DayThread {
  date: string;
  title: string;
  subtitle: string;
  lastTime: string;
  kcal: number;
  itemCount: number;
  searchText: string;
}

const HISTORY_LOAD_LIMIT = 500;

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n).trim()}…` : s);

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const groupLabel = (date: string, todayStr: string, yesterdayStr: string, weekAgoStr: string) => {
  if (date === todayStr) return 'Today';
  if (date === yesterdayStr) return 'Yesterday';
  if (date >= weekAgoStr) return 'Earlier this week';
  return 'Older';
};

const Conversations = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [threads, setThreads] = useState<DayThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [{ data: messages, error: msgErr }, { data: meals, error: mealErr }] = await Promise.all([
        supabase
          .from('chat_messages')
          .select('role, content, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(HISTORY_LOAD_LIMIT),
        supabase.from('daily_meals').select('logged_date, calories').eq('user_id', user.id),
      ]);
      if (msgErr) console.error('Error loading conversations:', msgErr);
      if (mealErr) console.error('Error loading meal totals:', mealErr);

      const kcalByDate = new Map<string, number>();
      const countByDate = new Map<string, number>();
      for (const m of meals ?? []) {
        const d = m.logged_date as string;
        kcalByDate.set(d, (kcalByDate.get(d) ?? 0) + (Number(m.calories) || 0));
        countByDate.set(d, (countByDate.get(d) ?? 0) + 1);
      }

      const byDate = new Map<string, { role: string; content: string; created_at: string }[]>();
      for (const row of messages ?? []) {
        const d = row.created_at.split('T')[0];
        if (!byDate.has(d)) byDate.set(d, []);
        byDate.get(d)!.push(row);
      }

      const grouped: DayThread[] = [...byDate.entries()]
        .map(([date, rows]) => {
          const firstUser = rows.find((r) => r.role === 'user') ?? rows[0];
          const last = rows[rows.length - 1];
          return {
            date,
            title: truncate(firstUser.content, 60),
            subtitle: truncate(last.content, 70),
            lastTime: last.created_at,
            kcal: Math.round(kcalByDate.get(date) ?? 0),
            itemCount: countByDate.get(date) ?? 0,
            searchText: rows.map((r) => r.content).join(' ').toLowerCase(),
          };
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      setThreads(grouped);
      setLoading(false);
    })();
  }, [user]);

  const { todayStr, yesterdayStr, weekAgoStr } = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);
    return {
      todayStr: today.toISOString().split('T')[0],
      yesterdayStr: yesterday.toISOString().split('T')[0],
      weekAgoStr: weekAgo.toISOString().split('T')[0],
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => t.searchText.includes(q));
  }, [threads, query]);

  const groups = useMemo(() => {
    const order = ['Today', 'Yesterday', 'Earlier this week', 'Older'];
    const map = new Map<string, DayThread[]>();
    for (const t of filtered) {
      const label = groupLabel(t.date, todayStr, yesterdayStr, weekAgoStr);
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(t);
    }
    return order.filter((label) => map.has(label)).map((label) => ({ label, threads: map.get(label)! }));
  }, [filtered, todayStr, yesterdayStr, weekAgoStr]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-foreground">Conversations</h1>
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      <div className="flex h-10 items-center gap-2 rounded-xl border border-border bg-muted/40 px-3">
        <Search className="h-3.5 w-3.5 flex-none text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a food, a day, a number…"
          className="h-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-pulse rounded-full bg-primary" />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <MessagesSquare className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {query ? 'No conversations match that search.' : 'No conversations yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </span>
              <div className="space-y-2">
                {group.threads.map((t) => (
                  <button
                    key={t.date}
                    type="button"
                    onClick={() => navigate(`/chat?date=${t.date}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left"
                  >
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{t.title}</span>
                        <span className="flex-none font-mono text-[10px] text-muted-foreground">
                          {formatTime(t.lastTime)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{t.subtitle}</p>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {t.kcal > 0 ? `${t.kcal.toLocaleString()} kcal logged` : 'Nothing logged'}
                        </span>
                        {t.itemCount > 0 && (
                          <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                            {t.itemCount} item{t.itemCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-none text-muted-foreground/50" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Conversations;
