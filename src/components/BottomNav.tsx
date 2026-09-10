import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, Search, Plus, Calendar, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { path: '/', icon: Home, label: 'Today' },
  { path: '/add-meal', icon: Search, label: 'Add' },
] as const;

const trailingTabs = [
  { path: '/history', icon: Calendar, label: 'History' },
  { path: '/profile', icon: User, label: 'You' },
] as const;

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const renderTab = ({
    path,
    icon: Icon,
    label,
  }: (typeof tabs)[number] | (typeof trailingTabs)[number]) => {
    const isActive = location.pathname === path;
    return (
      <Link
        key={path}
        to={path}
        className="flex flex-1 flex-col items-center justify-center gap-1 min-h-12"
      >
        <Icon
          className={cn('w-5 h-5', isActive ? 'text-primary' : 'text-muted-foreground')}
        />
        <span
          className={cn(
            'text-[10px] leading-none',
            isActive ? 'font-semibold text-primary' : 'font-medium text-muted-foreground'
          )}
        >
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav
      className="elevation-glass fixed left-3 right-3 z-40 flex items-center justify-between rounded-[20px] px-1.5 py-2"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
    >
      {tabs.map(renderTab)}
      <div className="flex flex-1 justify-center">
        <button
          onClick={() => navigate('/add-meal')}
          aria-label="Add meal"
          className="flex h-[50px] w-[50px] items-center justify-center rounded-2xl bg-primary shadow-[0_10px_24px_-8px_hsl(var(--primary)/0.95)]"
        >
          <Plus className="h-6 w-6 text-primary-foreground" strokeWidth={2.4} />
        </button>
      </div>
      {trailingTabs.map(renderTab)}
    </nav>
  );
};

export default BottomNav;
