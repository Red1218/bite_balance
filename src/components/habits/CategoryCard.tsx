import { useState, type CSSProperties } from 'react';
import { Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { dayProgress, dayState, logOn, type Habit, type LogIndex, type TimeOfDay } from '@/lib/habits';
import type { LogPatch } from '@/hooks/useHabits';
import HabitRow from './HabitRow';
import { HabitTile, TIME_LABEL } from './habitUi';

export const categoryLabel = (name: string | null) => name ?? 'Other';

// Each category takes the next colour, so the page reads as three or four distinct groups.
const CATEGORY_COLORS = ['--chart-steps', '--chart-fiber', '--chart-water', '--chart-fat', '--chart-carbs'];

type Shape = 'routine' | 'tiles' | 'slots';
type Slot = TimeOfDay | 'week';
const SLOT_ORDER: Slot[] = ['morning', 'afternoon', 'evening', 'anytime', 'week'];
const SLOT_LABEL: Record<Slot, string> = { ...TIME_LABEL, week: 'This week' };
const slotOf = (h: Habit): Slot => (h.schedule === 'per_week' ? 'week' : h.time_of_day);

// The group's shape follows its habits: timed ones sort into slots, a few simple ticks become big
// tiles, anything else stays a list of full rows (which keep swipe, counts and skips).
export const categoryShape = (habits: Habit[]): Shape => {
  if (habits.some((h) => slotOf(h) !== 'anytime')) return 'slots';
  if (habits.length <= 3 && habits.every((h) => h.kind === 'check')) return 'tiles';
  return 'routine';
};

interface CategoryCardProps {
  name: string | null;
  index: number;
  habits: Habit[];
  idx: LogIndex;
  date: string;
  today: string;
  closed: boolean;
  onToggle: () => void;
  onRename: () => void;
  onWrite: (habit: Habit, next: LogPatch | null) => void;
  onOpen: (habit: Habit) => void;
}

// One category on the Habits page, tinted in its own colour. Its count stays visible when folded away.
const CategoryCard = ({ name, index, habits, idx, date, today, closed, onToggle, onRename, onWrite, onOpen }: CategoryCardProps) => {
  const label = categoryLabel(name);
  const done = habits.filter((h) => dayProgress([h], idx, date, today).done === 1).length;
  const total = habits.length;
  const shape = categoryShape(habits);
  const style = { '--cat': `hsl(var(${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}))` } as CSSProperties;
  const row = (h: Habit) => (
    <HabitRow key={h.id} habit={h} idx={idx} date={date} today={today} onWrite={(next) => onWrite(h, next)} onOpen={() => onOpen(h)} />
  );

  return (
    <section style={style} className="overflow-hidden rounded-3xl bg-[color-mix(in_srgb,var(--cat)_12%,hsl(var(--card)))]">
      <div className="flex items-center pr-1.5">
        <button type="button" aria-expanded={!closed} onClick={onToggle} className="flex min-h-[72px] min-w-0 flex-1 flex-col gap-1.5 px-4 py-3 text-left">
          <span className="flex w-full items-center gap-2">
            <span className="truncate text-[12px] font-bold uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--cat)_75%,hsl(var(--foreground)))]">{label}</span>
            <ChevronDown className={cn('ml-auto h-4 w-4 flex-none text-muted-foreground transition-transform duration-200', !closed && 'rotate-180')} />
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-[26px] font-bold leading-none">{done}</span>
            <span className="text-sm text-muted-foreground">of {total} done</span>
          </span>
          <span className="flex w-full gap-[3px]" aria-hidden>
            {habits.map((h, i) => (
              <span key={h.id} className={cn('h-1.5 flex-1 rounded-full transition-colors duration-300', i < done ? 'bg-[var(--cat)]' : 'bg-[color-mix(in_srgb,var(--cat)_22%,transparent)]')} />
            ))}
          </span>
        </button>
        <button type="button" aria-label={`Rename ${label}`} onClick={onRename} className="flex h-11 w-11 flex-none items-center justify-center self-start rounded-full text-muted-foreground">
          <Pencil className="h-[18px] w-[18px]" />
        </button>
      </div>

      {!closed && shape === 'routine' && <div className="divide-y divide-border border-t border-border">{habits.map(row)}</div>}

      {!closed && shape === 'slots' && (
        <div className="flex flex-col gap-2 px-2 pb-2">
          {SLOT_ORDER.map((slot) => {
            const inSlot = habits.filter((h) => slotOf(h) === slot);
            if (!inSlot.length) return null;
            return (
              <div key={slot} className="overflow-hidden rounded-2xl">
                <div className="bg-card px-3 pb-1 pt-2.5 text-[12px] font-semibold text-muted-foreground">{SLOT_LABEL[slot]}</div>
                <div className="divide-y divide-border">{inSlot.map(row)}</div>
              </div>
            );
          })}
        </div>
      )}

      {!closed && shape === 'tiles' && (
        <div className="grid grid-cols-2 gap-2 px-2 pb-2">
          {habits.map((h) => (
            <HabitBigTile key={h.id} habit={h} done={dayState(h, idx, date, today) === 'done'} note={logOn(idx, h.id, date)?.note ?? null} onWrite={(next) => onWrite(h, next)} onOpen={() => onOpen(h)} />
          ))}
        </div>
      )}
    </section>
  );
};

// A big tap target for a simple daily tick. A short habit note ("5g") becomes the headline.
const HabitBigTile = ({ habit, done, note, onWrite, onOpen }: { habit: Habit; done: boolean; note: string | null; onWrite: (next: LogPatch | null) => void; onOpen: () => void }) => {
  const [tapped, setTapped] = useState(false);
  const headline = habit.note && habit.note.length <= 8 ? habit.note : null;
  return (
    <div
      className={cn(
        'relative flex min-h-[124px] flex-col overflow-hidden rounded-2xl border-[1.5px] transition-colors duration-300',
        done ? 'border-transparent bg-[color-mix(in_srgb,var(--cat)_24%,hsl(var(--card)))]' : 'border-dashed border-[color-mix(in_srgb,var(--cat)_40%,transparent)] bg-card'
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={habit.name}
        onClick={() => {
          setTapped(true);
          onWrite(done ? null : { status: 'done', count: null, note });
        }}
        className="flex flex-1 flex-col items-start gap-1.5 p-3 pr-11 text-left active:scale-[.98]"
      >
        {headline ? (
          <span className={cn('font-display text-[26px] font-bold leading-none', done ? 'text-[var(--cat)]' : 'text-muted-foreground')}>{headline}</span>
        ) : (
          <HabitTile habit={habit} size={32} />
        )}
        <span className="mt-auto text-[15px] font-semibold leading-tight">{habit.name}</span>
        <span className={cn('flex items-center gap-1 text-xs', done ? 'font-medium text-[color:color-mix(in_srgb,var(--cat)_75%,hsl(var(--foreground)))]' : 'text-muted-foreground')}>
          {done && <Check className={cn('h-3.5 w-3.5', tapped && 'motion-pop')} strokeWidth={3} />}
          {done ? 'Done' : 'Tap when done'}
        </span>
      </button>
      <button type="button" onClick={onOpen} aria-label={`Open ${habit.name}`} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

interface CategoryRenameSheetProps {
  name: string | null;
  count: number;
  onClose: () => void;
  onSave: (next: string) => Promise<boolean>;
}

// Mounted only while renaming, so the field starts from the current name each time.
export const CategoryRenameSheet = ({ name, count, onClose, onSave }: CategoryRenameSheetProps) => {
  const [draft, setDraft] = useState(name ?? '');
  const [saving, setSaving] = useState(false);
  const next = draft.trim();

  const save = async () => {
    if (next === name) return onClose();
    setSaving(true);
    const saved = await onSave(next);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">Rename category</DrawerTitle>
        <div className="space-y-3.5 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">{name ? 'Rename category' : 'Name these habits'}</div>
          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-muted-foreground">Name</span>
            <Input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={30} className="h-12 text-base" />
          </label>
          <p className="text-sm text-muted-foreground">
            Applies to {count} {count === 1 ? 'habit' : 'habits'}. Using another category's name merges them.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="h-12 rounded-full bg-muted text-[15px] font-semibold">Cancel</button>
            <button type="button" disabled={!next || saving} onClick={save} className="h-12 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default CategoryCard;
