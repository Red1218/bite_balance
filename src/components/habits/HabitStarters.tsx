import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HabitValues } from '@/lib/habits';
import { BLANK_HABIT } from './HabitSheet';
import { HabitTile, Ring } from './habitUi';

const STARTERS: (HabitValues & { blurb: string })[] = [
  { ...BLANK_HABIT, name: 'Vitamin D', icon: 'sun', color: 'amber', category: 'supplements', time_of_day: 'morning', blurb: 'Supplements · morning · yes/no' },
  { ...BLANK_HABIT, name: 'Drink water', kind: 'count', target: 8, unit: 'glasses', icon: 'droplet', color: 'sky', category: 'nutrition', blurb: 'Nutrition · 8 glasses a day' },
  { ...BLANK_HABIT, name: '10k steps', kind: 'count', target: 10000, unit: 'steps', icon: 'footprints', color: 'orange', category: 'fitness', blurb: 'Fitness · 10,000 steps a day' },
  { ...BLANK_HABIT, name: 'Hit protein goal', icon: 'target', color: 'violet', category: 'nutrition', time_of_day: 'evening', blurb: 'Nutrition · evening · yes/no' },
  { ...BLANK_HABIT, name: 'Sleep by 11', icon: 'moon', color: 'violet', category: 'sleep', time_of_day: 'evening', blurb: 'Sleep · evening · yes/no' },
];

// Empty state: pick suggested habits, add them in one go, or make your own.
const HabitStarters = ({ onAdd, onCreate }: { onAdd: (list: HabitValues[]) => Promise<boolean>; onCreate: () => void }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const toggle = (name: string) => setPicked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const add = async () => {
    setBusy(true);
    const chosen = picked.length ? STARTERS.filter((s) => picked.includes(s.name)) : STARTERS;
    await onAdd(chosen.map(({ blurb: _blurb, ...values }) => values));
    setBusy(false);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center gap-4 px-0.5 pt-2">
        <Ring value={0} size={72} stroke={10} />
        <div>
          <h2 className="text-[21px] font-semibold leading-tight">Build your daily routine</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Pick a few to start. You can change targets, times and reminders later.</p>
        </div>
      </div>

      <div className="flex items-baseline justify-between px-1 pt-1">
        <span className="font-sans text-[12px] font-semibold text-muted-foreground">Suggested</span>
        <span className="font-mono text-xs text-muted-foreground">{picked.length} of {STARTERS.length} picked</span>
      </div>
      <div className="elevation-card divide-y divide-border rounded-2xl p-0">
        {STARTERS.map((s) => {
          const on = picked.includes(s.name);
          return (
            <div key={s.name} className="flex min-h-[66px] items-center gap-3 pl-3 pr-2">
              <HabitTile habit={s} size={40} />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.blurb}</div>
              </div>
              <button
                type="button"
                aria-pressed={on}
                aria-label={on ? `${s.name} picked. Tap to remove` : `Pick ${s.name}`}
                onClick={() => toggle(s.name)}
                className={cn(
                  'flex h-11 min-w-[76px] items-center justify-center gap-1 rounded-full border-[1.5px] px-3 text-[13px] font-semibold',
                  on ? 'border-chart-fiber bg-chart-fiber text-white' : 'border-primary text-primary'
                )}
              >
                {on ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />}
                {on ? 'Picked' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>

      <button type="button" onClick={add} disabled={busy} className="h-[52px] w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
        {busy ? 'Adding…' : picked.length ? `Add ${picked.length} ${picked.length === 1 ? 'habit' : 'habits'}` : `Add all ${STARTERS.length}`}
      </button>
      <button type="button" onClick={onCreate} className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card text-sm font-semibold">
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        Create your own
      </button>
    </div>
  );
};

export default HabitStarters;
