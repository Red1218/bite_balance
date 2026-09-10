import { useAuth } from '@/contexts/AuthContext';

interface DashboardHeaderProps {
  todayDate: string;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const DashboardHeader = ({ todayDate }: DashboardHeaderProps) => {
  const { user } = useAuth();

  const fullName: string = user?.user_metadata?.full_name || '';
  const firstName = fullName.split(' ')[0] || user?.email?.split('@')[0] || 'there';

  return (
    <div className="animate-fade-in-up">
      <p className="truncate font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {todayDate}
      </p>
      <h1 className="mt-1.5 font-display text-2xl font-bold leading-tight tracking-tight text-foreground sm:text-3xl">
        {getGreeting()}, {firstName}
      </h1>
    </div>
  );
};

export default DashboardHeader;
