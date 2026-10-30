import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { categoryNames, type Habit } from '@/lib/habits';
import { categoryLabel } from './CategoryCard';
import { HabitTile } from './habitUi';

interface CategoryRowProps {
  name: string;
  count: number;
  onRename: (from: string, to: string | null) => Promise<boolean>;
}

// Saves when the field loses focus. Remove asks for a second tap, since it can't be undone in one step.
const CategoryRow = ({ name, count, onRename }: CategoryRowProps) => {
  const [draft, setDraft] = useState(name);
  const [confirming, setConfirming] = useState(false);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) void onRename(name, next);
    else setDraft(name);
  };

  return (
    <div className="flex min-h-16 items-center gap-2 py-2 pl-3 pr-1.5">
      <Input
        aria-label={`Name of ${name}`}
        value={draft}
        maxLength={30}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className="h-11 min-w-0 flex-1 text-[15px]"
      />
      {confirming ? (
        <button
          type="button"
          onClick={() => onRename(name, null)}
          onBlur={() => setConfirming(false)}
          autoFocus
          className="h-11 flex-none rounded-full bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground"
        >
          Remove
        </button>
      ) : (
        <>
          <span className="w-[62px] flex-none text-right text-xs text-muted-foreground">
            <span className="font-mono">{count}</span> {count === 1 ? 'habit' : 'habits'}
          </span>
          <button
            type="button"
            aria-label={`Remove ${name}`}
            onClick={() => setConfirming(true)}
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </>
      )}
    </div>
  );
};

interface NewCategorySheetProps {
  habits: Habit[];
  onClose: () => void;
  onCreate: (name: string, ids: string[]) => Promise<boolean>;
}

// A category exists through its habits, so a new one picks them straight away.
const NewCategorySheet = ({ habits, onClose, onCreate }: NewCategorySheetProps) => {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const next = name.trim();

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  const save = async () => {
    setSaving(true);
    const saved = await onCreate(next, picked);
    setSaving(false);
    if (saved) onClose();
  };

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="max-h-[92vh] rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">New category</DrawerTitle>
        <div className="flex min-h-0 flex-col gap-3.5 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">New category</div>
          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-muted-foreground">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="h-12 text-base" />
          </label>
          <div className="text-[12px] font-semibold text-muted-foreground">Habits to move here</div>
          <div className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
            {habits.map((h) => {
              const on = picked.includes(h.id);
              return (
                <button
                  key={h.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(h.id)}
                  className="flex min-h-14 w-full items-center gap-3 py-1.5 text-left"
                >
                  <HabitTile habit={h} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{h.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{categoryLabel(h.category)}</span>
                  </span>
                  <span className={cn('flex h-6 w-6 flex-none items-center justify-center rounded-full border-2', on ? 'border-chart-fiber bg-chart-fiber text-background' : 'border-muted-foreground/45')}>
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="h-12 rounded-full bg-muted text-[15px] font-semibold">Cancel</button>
            <button type="button" disabled={!next || !picked.length || saving} onClick={save} className="h-12 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

interface CategoryEditListProps {
  habits: Habit[]; // all habits, archived too
  onRename: (from: string, to: string | null) => Promise<boolean>;
  onCreate: (name: string, ids: string[]) => Promise<boolean>;
}

const CategoryEditList = ({ habits, onRename, onCreate }: CategoryEditListProps) => {
  const [adding, setAdding] = useState(false);
  const active = habits.filter((h) => !h.archived_at);
  const names = categoryNames(habits);

  return (
    <div className="space-y-3.5">
      <p className="px-1 text-[13px] text-muted-foreground">
        Removing a category moves its habits to Other. Using another category's name merges them.
      </p>
      {names.length > 0 && (
        <div className="elevation-card divide-y divide-border rounded-2xl p-0">
          {names.map((name) => (
            <CategoryRow key={name} name={name} count={active.filter((h) => h.category === name).length} onRename={onRename} />
          ))}
        </div>
      )}
      <button type="button" onClick={() => setAdding(true)} className="flex h-12 w-full items-center justify-center gap-1.5 rounded-full bg-muted text-sm font-semibold">
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.4} /> New category
      </button>
      {adding && <NewCategorySheet habits={active} onClose={() => setAdding(false)} onCreate={onCreate} />}
    </div>
  );
};

export default CategoryEditList;
