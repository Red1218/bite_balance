import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Flame, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { itemRate, itemStreak, scheduleLabel, type ChecklistCheck, type ChecklistItem } from '@/lib/checklist';

interface ChecklistItemsListProps {
  items: ChecklistItem[]; // active items, in saved order
  checks: ChecklistCheck[]; // must cover the last year for streaks to be complete
  today: string;
  onEdit: (item: ChecklistItem) => void;
  onReorder: (orderedIds: string[]) => Promise<boolean>;
}

const ItemText = ({ item }: { item: ChecklistItem }) => (
  <span className="min-w-0 flex-1">
    <span className="block break-words text-sm text-foreground">{item.name}</span>
    {item.note && <span className="block break-words text-xs text-muted-foreground">{item.note}</span>}
  </span>
);

const SortableRow = ({ item }: { item: ChecklistItem }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('relative flex items-center gap-2 bg-card px-[14px] py-3', isDragging && 'z-10 shadow-lg')}
    >
      <ItemText item={item} />
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag to reorder ${item.name}`}
        className="flex h-10 w-10 flex-none touch-none items-center justify-center rounded-lg text-muted-foreground active:bg-muted"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
    </div>
  );
};

const ChecklistItemsList = ({ items, checks, today, onEdit, onReorder }: ChecklistItemsListProps) => {
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const startReorder = () => {
    setOrder(items.map((i) => i.id));
    setReordering(true);
  };

  // On failure the hook has already reverted and shown a toast; stay in reorder mode to retry.
  const finishReorder = async () => {
    if (await onReorder(order)) setReordering(false);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setOrder((prev) => arrayMove(prev, prev.indexOf(String(active.id)), prev.indexOf(String(over.id))));
  };

  const byId = new Map(items.map((i) => [i.id, i]));

  return (
    <div className="space-y-2">
      <div className="flex h-5 items-center justify-between">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Items</div>
        {items.length > 1 && (
          <button
            type="button"
            onClick={reordering ? finishReorder : startReorder}
            className="-my-2 px-1 py-2 text-[13px] font-medium text-primary"
          >
            {reordering ? 'Done' : 'Reorder'}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="elevation-card p-6 text-center text-sm text-muted-foreground">No items yet. Tap Add to create your first one.</div>
      ) : reordering ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="elevation-card divide-y divide-border overflow-hidden p-0">
              {order.map((id) => byId.get(id) && <SortableRow key={id} item={byId.get(id)!} />)}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="elevation-card divide-y divide-border overflow-hidden p-0">
          {items.map((item) => {
            const streak = itemStreak(item, checks, today);
            const rate = itemRate(item, checks, today);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onEdit(item)}
                className="flex w-full items-center justify-between gap-3 px-[14px] py-3 text-left"
              >
                <ItemText item={item} />
                <span className="flex flex-none flex-col items-end gap-1 font-mono text-[11px] tabular-nums text-muted-foreground">
                  <span>{scheduleLabel(item.weekdays)}</span>
                  {rate !== null && (
                    <span className="flex items-center gap-1">
                      {streak > 0 && (
                        <>
                          <Flame className="h-3 w-3 text-chart-carbs" />
                          <span className="text-foreground">{streak}</span>
                          <span>·</span>
                        </>
                      )}
                      <span>{rate}%</span>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChecklistItemsList;
