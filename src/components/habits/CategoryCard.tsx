import { useState, type ReactNode } from 'react';
import { ChevronDown, Pencil } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Ring } from './habitUi';

export const categoryLabel = (name: string | null) => name ?? 'Other';

interface CategoryCardProps {
  name: string | null;
  done: number;
  total: number;
  closed: boolean;
  onToggle: () => void;
  onRename: () => void;
  children: ReactNode;
}

// One category on the Habits page: its ring and count stay visible when the rows are folded away.
const CategoryCard = ({ name, done, total, closed, onToggle, onRename, children }: CategoryCardProps) => {
  const label = categoryLabel(name);
  return (
    <section className="elevation-card overflow-hidden rounded-2xl p-0">
      <div className="flex items-center pr-1.5">
        <button type="button" aria-expanded={!closed} onClick={onToggle} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 p-3 text-left">
          <Ring value={done / total} size={44} stroke={5} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-semibold">{label}</span>
            <span className={cn('block text-xs', done === total ? 'font-medium text-chart-fiber' : 'text-muted-foreground')}>
              <span className="font-mono">{done} of {total}</span> done
            </span>
          </span>
          <ChevronDown className={cn('h-5 w-5 flex-none text-muted-foreground transition-transform duration-200', !closed && 'rotate-180')} />
        </button>
        <button type="button" aria-label={`Rename ${label}`} onClick={onRename} className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground">
          <Pencil className="h-[18px] w-[18px]" />
        </button>
      </div>
      {!closed && <div className="divide-y divide-border border-t border-border">{children}</div>}
    </section>
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
