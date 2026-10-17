import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { Footprints, BookmarkPlus, MessagesSquare, FileSpreadsheet, Calendar, type LucideIcon } from 'lucide-react';
import { cn, fmtLocalDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useHealthConnect } from '@/hooks/useHealthConnect';

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecentChat {
  date: string;
  text: string;
}

const dayLabel = (date: string) => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date === fmtLocalDate(today)) return 'Today';
  if (date === fmtLocalDate(yesterday)) return 'Yesterday';
  return new Date(`${date}T00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
};

// The menu sits on the page itself; AppLayout pushes the app aside to uncover it.
const AppDrawer = ({ open, onOpenChange }: AppDrawerProps) => {
  const location = useLocation();
  const { user } = useAuth();
  const { isConnected, healthData } = useHealthConnect();
  const [name, setName] = useState<string>(user?.user_metadata?.full_name || '');
  const [chats, setChats] = useState<RecentChat[]>([]);

  // Fetched each time the menu opens, so the recent chats are current.
  useEffect(() => {
    if (!open || !user) return;
    supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setName(data.name);
      });
    supabase
      .from('chat_messages')
      .select('content, created_at')
      .eq('user_id', user.id)
      .eq('role', 'user')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        // The newest thing you said on each of the last two days you chatted.
        const byDay = new Map<string, string>();
        for (const m of data ?? []) {
          const d = fmtLocalDate(new Date(m.created_at));
          if (!byDay.has(d)) byDay.set(d, m.content);
          if (byDay.size === 2) break;
        }
        setChats([...byDay].map(([date, text]) => ({ date, text })));
      });
  }, [open, user]);

  const initials = (name || user?.email || 'U').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  const close = () => onOpenChange(false);

  const item = (path: string, Icon: LucideIcon, label: string, badge?: string) => {
    const isActive = location.pathname === path;
    return (
      <Link
        key={path}
        to={path}
        onClick={close}
        className={cn(
          'flex h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-semibold transition-colors active:scale-[.98]',
          isActive ? 'bg-card text-foreground' : 'text-muted-foreground'
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-primary' : 'text-faint')} />
        <span className="flex-1">{label}</span>
        {badge && <span className="text-xs font-medium text-faint">{badge}</span>}
      </Link>
    );
  };

  const group = (label: string) => (
    <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-faint">{label}</div>
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Clear: the pushed-aside app shows through, and tapping it closes the menu. */}
        <Dialog.Overlay className="fixed inset-0 z-50" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed bottom-0 left-0 top-0 z-50 flex w-[64%] max-w-[300px] flex-col gap-5 pr-3 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-left-6 data-[state=open]:slide-in-from-left-6 data-[state=closed]:duration-300 data-[state=open]:duration-500"
          style={{
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 28px)',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
          }}
        >
          <Dialog.Title className="sr-only">Menu</Dialog.Title>

          <nav className="flex flex-col gap-0.5">
            {group('Track')}
            {item('/history', Calendar, 'History')}
            {item('/steps', Footprints, 'Steps', isConnected && healthData ? healthData.steps.toLocaleString() : undefined)}
          </nav>

          <nav className="flex flex-col gap-0.5">
            {group('Library')}
            {item('/saved-meals', BookmarkPlus, 'Saved')}
            {item('/import', FileSpreadsheet, 'Import log')}
          </nav>

          <div className="flex min-h-0 flex-col gap-1.5">
            {group('Recent chats')}
            {chats.map((c) => (
              <Link
                key={c.date}
                to={`/chat?date=${c.date}`}
                onClick={close}
                className="rounded-[14px] bg-card px-3 py-2.5 active:scale-[.98]"
              >
                <span className="line-clamp-2 text-[13px] leading-snug text-foreground">{c.text}</span>
                <span className="mt-0.5 block text-[11px] text-faint">{dayLabel(c.date)}</span>
              </Link>
            ))}
            {item('/conversations', MessagesSquare, 'All conversations')}
          </div>

          <Link to="/profile" onClick={close} className="mt-auto flex items-center gap-3 rounded-[14px] p-2 active:scale-[.98]">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-muted font-display text-sm font-bold text-chart-protein">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground">{name.trim().split(/\s+/)[0] || 'You'}</span>
              <span className="block text-xs text-faint">View profile</span>
            </span>
          </Link>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default AppDrawer;
