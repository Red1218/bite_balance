import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DashboardHeaderProps {
  todayDate: string;
  onOpenMenu: () => void;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 18) return 'Afternoon';
  return 'Evening';
};

const DashboardHeader = ({ todayDate, onOpenMenu }: DashboardHeaderProps) => {
  const { user } = useAuth();
  // The name lives on the profile row; sign-up metadata often has none.
  const [name, setName] = useState<string>(user?.user_metadata?.full_name || '');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.name) setName(data.name);
      });
  }, [user]);

  const firstName = name.trim().split(/\s+/)[0] || user?.email?.split('@')[0] || 'there';
  const initials = (name || user?.email || 'U').trim().split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{todayDate}</p>
        <h1 className="mt-0.5 truncate font-display text-[28px] font-bold leading-tight tracking-[-0.02em] text-foreground">
          {getGreeting()}, {firstName}
        </h1>
      </div>
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-muted font-display text-[15px] font-bold text-chart-protein transition-transform active:scale-95"
      >
        {initials}
      </button>
    </div>
  );
};

export default DashboardHeader;
