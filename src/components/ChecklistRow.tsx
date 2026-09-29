import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItem } from '@/lib/checklist';

// One tickable item. Ticked rows stay in place (no reordering) so the list never jumps under a thumb.
const ChecklistRow = ({ item, checked, onToggle }: { item: ChecklistItem; checked: boolean; onToggle: () => void }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    onClick={onToggle}
    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-muted/60"
  >
    <span
      className={cn(
        'flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full border-2 transition-colors',
        checked ? 'border-chart-fiber bg-chart-fiber text-background' : 'border-muted-foreground/50'
      )}
    >
      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
    <span className="min-w-0 flex-1">
      <span className={cn('block break-words text-sm', checked ? 'text-muted-foreground line-through' : 'text-foreground')}>
        {item.name}
      </span>
      {item.note && <span className="block break-words text-xs text-muted-foreground">{item.note}</span>}
    </span>
  </button>
);

export default ChecklistRow;
