import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { addDays, dayProgress, isDueOn } from '@/lib/habits';
import { useHabits, useLocalToday } from '@/hooks/useHabits';
import HabitRow from './HabitRow';
import { Ring } from './habitUi';

// Dashboard card: today's habits, tickable in place.
const HabitsCard = () => {
  const navigate = useNavigate();
  const today = useLocalToday();
  // A year of history, so the streaks on the rows match the Habits page.
  const { habits, idx, loading, error, writeLog } = useHabits(addDays(today, -364), today);
  const active = habits.filter((h) => !h.archived_at);
  const due = active.filter((h) => isDueOn(h, idx, today, today));
  const p = dayProgress(habits, idx, today, today);
  const allDone = p.due > 0 && p.done === p.due;

  return (
    <div className="elevation-card flex flex-col gap-1 p-[14px]">
      <div className="flex items-center justify-between">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Habits</span>
        <div className="flex items-center gap-3">
          {p.due > 0 && (
            <span className={cn('flex items-center gap-1.5 font-mono text-xs font-semibold', allDone ? 'text-chart-fiber' : 'text-muted-foreground')}>
              <Ring value={p.pct / 100} size={16} stroke={3} />
              {allDone ? 'All done' : `${p.done} / ${p.due}`}
            </span>
          )}
          <Link to="/habits" className="-my-3 flex h-11 items-center text-xs font-medium text-primary">
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
      ) : active.length === 0 ? (
        <div className="flex items-center justify-between gap-3 pt-1">
          <p className="text-sm text-muted-foreground">Track supplements, water, steps and more</p>
          <Link to="/habits" className="flex h-11 flex-none items-center rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground">
            Start
          </Link>
        </div>
      ) : due.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled today</p>
      ) : (
        <div className="-mx-[14px] -mb-2 divide-y divide-border">
          {due.map((h) => (
            <HabitRow key={h.id} habit={h} idx={idx} date={today} today={today} onWrite={(next) => writeLog(h.id, today, next)} onOpen={() => navigate(`/habits/${h.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HabitsCard;
