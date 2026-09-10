import { Link, useLocation } from 'react-router-dom';
import { BookmarkPlus, Footprints, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSavedMeals } from '@/hooks/useSavedMeals';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import LogoMark from '@/components/LogoMark';

interface AppDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AppDrawer = ({ open, onOpenChange }: AppDrawerProps) => {
  const location = useLocation();
  const { meals } = useSavedMeals();
  const { isConnected, healthData } = useHealthConnect();

  const navItems = [
    { path: '/saved-meals', icon: BookmarkPlus, label: 'Saved meals', badge: meals.length ? String(meals.length) : undefined },
    { path: '/steps', icon: Footprints, label: 'Steps', badge: isConnected && healthData ? healthData.steps.toLocaleString() : undefined },
  ] as const;

  const renderItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        onClick={() => onOpenChange(false)}
        className={cn(
          'flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors',
          isActive
            ? 'bg-primary/14 border border-primary/28 text-primary'
            : 'text-foreground/80 hover:bg-muted'
        )}
      >
        <Icon className={cn('h-[18px] w-[18px]', isActive ? 'text-primary' : 'text-muted-foreground')} />
        <span className="flex-1">{item.label}</span>
        {item.badge && (
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{item.badge}</span>
        )}
      </Link>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[300px] max-w-[85vw] flex-col gap-1 border-r border-white/10 bg-background/95 p-4 backdrop-blur-xl"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="flex items-center gap-3 px-1 pb-3 pt-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary">
            <LogoMark size={21} />
          </div>
          <div className="font-display text-base font-semibold tracking-tight">Bite Balance</div>
        </div>
        <div className="h-px bg-border" />
        <nav className="flex flex-1 flex-col gap-1 py-3">
          <div className="px-3 pb-1 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            More
          </div>
          {navItems.map(renderItem)}
          <div className="my-2 h-px bg-border" />
          <div className="flex h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground/80">
            <HelpCircle className="h-[18px] w-[18px] text-muted-foreground" />
            <span className="flex-1">Help &amp; feedback</span>
          </div>
        </nav>
        <p className="px-1 pb-1 text-center font-mono text-[11px] text-faint">Bite Balance 2.0.1 · build 214</p>
      </SheetContent>
    </Sheet>
  );
};

export default AppDrawer;
