import { Link } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isChecked, isDue } from '@/lib/checklist';
import { useChecklist, useLocalToday } from '@/hooks/useChecklist';
import ChecklistRow from '@/components/ChecklistRow';

const ChecklistCard = () => {
  const today = useLocalToday();
  const { items, checks, loading, error, toggle } = useChecklist(today, today);
  const due = items.filter((i) => isDue(i, today));
  const done = due.filter((i) => isChecked(checks, i.id, today)).length;
  const hasItems = items.some((i) => !i.archived_at);
  const allDone = due.length > 0 && done === due.length;

  return (
    <div className="elevation-card flex flex-col gap-2.5 p-[14px]">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Checklist
        </span>
        <div className="flex items-center gap-3">
          {due.length > 0 && (
            <span className={cn('font-mono text-xs font-semibold tabular-nums', allDone ? 'text-chart-fiber' : 'text-muted-foreground')}>
              {allDone ? 'All done' : `${done} / ${due.length}`}
            </span>
          )}
          <Link to="/checklist" className="flex items-center text-xs font-medium text-primary">
            All
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex h-12 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : !hasItems ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Track daily supplements and habits</p>
          <Link to="/checklist" className="flex-none rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">
            Add items
          </Link>
        </div>
      ) : due.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled today</p>
      ) : (
        <div className="-mx-1 flex flex-col">
          {due.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              checked={isChecked(checks, item.id, today)}
              onToggle={() => toggle(item.id, today)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ChecklistCard;
