import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { addDays, dayProgress } from '@/lib/habits';
import { useHabits, useLocalToday } from '@/hooks/useHabits';

const MAX_DOTS = 12;

// Today's one-line habit summary; ticking happens on the Habits tab.
const HabitsCard = () => {
  const today = useLocalToday();
  // A year of history, the same window the Habits page reads, so per-week schedules agree.
  const { habits, idx, loading, error } = useHabits(addDays(today, -364), today);
  const active = habits.filter((h) => !h.archived_at);
  const p = dayProgress(habits, idx, today, today);
  const allDone = p.due > 0 && p.done === p.due;

  const summary = loading
    ? 'Loading…'
    : error
      ? 'Couldn’t load habits'
      : active.length === 0
        ? 'Track supplements, water, steps and more'
        : p.due === 0
          ? 'Nothing scheduled today'
          : allDone
            ? `All ${p.due} done`
            : `${p.done} of ${p.due} done`;

  return (
    <Link to="/habits" className="flex min-h-[64px] items-center gap-3.5 rounded-[20px] bg-card px-4 py-3.5 transition-transform active:scale-[.98]">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-[15px] font-semibold text-foreground">
          Habits <span className={allDone ? 'font-normal text-chart-fiber' : 'font-normal text-muted-foreground'}>{summary}</span>
        </span>
        {p.due > 0 &&
          (p.due <= MAX_DOTS ? (
            <span className="flex gap-[5px]" aria-hidden>
              {Array.from({ length: p.due }, (_, i) => (
                <span
                  key={i}
                  className={`h-1.5 w-[18px] rounded-full transition-colors duration-300 ${i < p.done ? 'bg-chart-fiber' : 'bg-border'}`}
                />
              ))}
            </span>
          ) : (
            <span className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
              <span className="block h-full rounded-full bg-chart-fiber" style={{ width: `${p.pct}%` }} />
            </span>
          ))}
      </div>
      <ChevronRight className="h-5 w-5 flex-none text-muted-foreground" />
    </Link>
  );
};

export default HabitsCard;
