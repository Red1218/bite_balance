import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIMES_OF_DAY, scheduleLabel, targetLabel, type Habit, type TimeOfDay } from '@/lib/habits';
import { HabitTile, SectionLabel, TIME_LABEL } from './habitUi';

const HEADER = 'hdr:';

const SortableHeader = ({ id }: { id: string }) => {
  const { setNodeRef, transform, transition } = useSortable({ id, disabled: true });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="px-1 pb-2 pt-4 first:pt-1">
      <SectionLabel>{TIME_LABEL[id.slice(HEADER.length) as TimeOfDay]}</SectionLabel>
    </div>
  );
};

const SortableHabit = ({ habit }: { habit: Habit }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: habit.id });
  const meta = [targetLabel(habit), scheduleLabel(habit)].filter(Boolean).join(' · ');
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex min-h-[58px] items-center gap-3 border-b border-border bg-card pl-3 pr-1', isDragging && 'z-10 rounded-xl shadow-lg ring-2 ring-primary')}
    >
      <HabitTile habit={habit} size={34} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{habit.name}</div>
        <div className="text-xs text-muted-foreground">{meta}</div>
      </div>
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag to reorder ${habit.name}`}
        className="flex h-11 w-11 flex-none touch-none items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
    </div>
  );
};

interface HabitEditListProps {
  habits: Habit[]; // all habits, in saved order
  order: string[]; // working order: group headers ('hdr:morning') and habit ids
  onOrderChange: (order: string[]) => void;
  onRestore: (id: string) => void;
}

// Builds the working order from saved habits: each time-of-day header followed by its habits.
export const initialOrder = (habits: Habit[]) =>
  TIMES_OF_DAY.flatMap((t) => [HEADER + t, ...habits.filter((h) => !h.archived_at && h.time_of_day === t).map((h) => h.id)]);

// Reads habits back out of the working order: each takes the group of the header above it.
export const orderToSave = (order: string[]) => {
  let group: TimeOfDay = 'morning';
  const out: { id: string; time_of_day: TimeOfDay }[] = [];
  for (const id of order) {
    if (id.startsWith(HEADER)) group = id.slice(HEADER.length) as TimeOfDay;
    else out.push({ id, time_of_day: group });
  }
  return out;
};

// Puts a restored habit at the end of its group.
export const withRestored = (order: string[], habit: Habit) => {
  const next = [...order];
  let at = next.indexOf(HEADER + habit.time_of_day) + 1;
  while (at < next.length && !next[at].startsWith(HEADER)) at++;
  next.splice(at, 0, habit.id);
  return next;
};

const HabitEditList = ({ habits, order, onOrderChange, onRestore }: HabitEditListProps) => {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const byId = new Map(habits.map((h) => [h.id, h]));
  const archived = habits.filter((h) => h.archived_at);
  const [restoring, setRestoring] = useState<string | null>(null);

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    // Keep the first header first, so every habit sits under a group.
    if (!next[0].startsWith(HEADER)) {
      const first = next.findIndex((id) => id.startsWith(HEADER));
      next.unshift(...next.splice(first, 1));
    }
    onOrderChange(next);
  };

  return (
    <div className="space-y-4">
      <p className="px-1 text-[13px] text-muted-foreground">Drag the handle to reorder. Dropping into another group changes its time of day.</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={order} strategy={verticalListSortingStrategy}>
          <div>
            {order.map((id) =>
              id.startsWith(HEADER) ? <SortableHeader key={id} id={id} /> : byId.get(id) && <SortableHabit key={id} habit={byId.get(id)!} />
            )}
          </div>
        </SortableContext>
      </DndContext>

      {archived.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-baseline justify-between px-1">
            <SectionLabel>Archived</SectionLabel>
            <span className="font-mono text-xs text-muted-foreground">{archived.length}</span>
          </div>
          <div className="elevation-card divide-y divide-border rounded-2xl p-0">
            {archived.map((h) => (
              <div key={h.id} className="flex min-h-[58px] items-center gap-3 pl-3 pr-1">
                <span className="opacity-60 grayscale"><HabitTile habit={h} size={34} /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium text-muted-foreground">{h.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Archived {new Date(h.archived_at!).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} · history kept
                  </div>
                </div>
                <button
                  type="button"
                  disabled={restoring === h.id}
                  onClick={() => {
                    setRestoring(h.id);
                    onRestore(h.id);
                  }}
                  className="h-11 rounded-full px-3 text-[13px] font-semibold text-primary disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
          <p className="px-1 text-xs text-muted-foreground">Archived habits keep their history and stay out of today and stats. Delete one from its page.</p>
        </section>
      )}
    </div>
  );
};

export default HabitEditList;
