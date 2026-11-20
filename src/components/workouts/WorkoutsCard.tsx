import { Link } from 'react-router-dom';
import { ChevronRight, Play } from 'lucide-react';
import { useWorkoutDraft, useWorkouts } from '@/hooks/useWorkouts';
import { Streak } from '@/components/habits/habitUi';
import { calendarWeeks, nextRoutine, nextUp, weekStreak } from '@/lib/workouts';

// Today's one-line workout summary: the workout in progress, or this week's days and what's next.
const WorkoutsCard = () => {
  const [draft] = useWorkoutDraft();
  const { workouts, routines, loading, error } = useWorkouts();

  if (draft) {
    return (
      <Link to="/workouts/log" className="flex min-h-[64px] items-center gap-3.5 rounded-[20px] bg-chart-fiber/15 px-4 py-3.5 transition-transform active:scale-[.98]">
        <span className="min-w-0 flex-1 text-[15px] font-semibold">
          Workout in progress <span className="font-normal text-muted-foreground">{draft.name}</span>
        </span>
        <span className="flex h-9 flex-none items-center gap-1.5 rounded-full bg-chart-fiber px-3.5 text-sm font-bold text-background">
          <Play className="h-3.5 w-3.5 fill-current" /> Resume
        </span>
      </Link>
    );
  }

  const now = Date.now();
  const days = calendarWeeks(workouts, now, 1)[0].days.filter((d) => d.trained).length;
  const streak = weekStreak(workouts, now);
  const next = nextRoutine(routines, workouts)?.name ?? nextUp(workouts)?.name;
  const summary = loading && !workouts.length
    ? 'Loading…'
    : error
      ? 'Couldn’t load workouts'
      : !workouts.length && !routines.length
        ? 'Log sets, reps and weights'
        : `${days} ${days === 1 ? 'day' : 'days'} this week`;

  return (
    <Link to="/workouts" className="flex min-h-[64px] items-center gap-3.5 rounded-[20px] bg-card px-4 py-3.5 transition-transform active:scale-[.98]">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-[15px] font-semibold text-foreground">
          Workouts <span className="font-normal text-muted-foreground">{summary}</span>
        </span>
        {(next || streak > 0) && (
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            {next && <span className="truncate">Next up: {next}</span>}
            {streak > 0 && <Streak value={streak} unit="wk" />}
          </span>
        )}
      </div>
      <ChevronRight className="h-5 w-5 flex-none text-muted-foreground" />
    </Link>
  );
};

export default WorkoutsCard;
