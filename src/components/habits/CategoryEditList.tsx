import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { categoryGroups, categoryNames, type Habit } from '@/lib/habits';
import { categoryLabel } from './CategoryCard';
import { HabitTile, SectionLabel } from './habitUi';

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

const Tick = ({ on }: { on: boolean }) => (
  <span className={cn('flex h-6 w-6 flex-none items-center justify-center rounded-full border-2', on ? 'border-chart-fiber bg-chart-fiber text-background' : 'border-muted-foreground/45')}>
    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
  </span>
);

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
                  <Tick on={on} />
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

interface MoveSheetProps {
  count: number;
  categories: string[];
  onClose: () => void;
  onMove: (name: string | null) => void;
}

const MoveSheet = ({ count, categories, onClose, onMove }: MoveSheetProps) => {
  const [name, setName] = useState('');
  const next = name.trim();
  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">Move habits</DrawerTitle>
        <div className="space-y-3.5 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">Move {count} {count === 1 ? 'habit' : 'habits'} to</div>
          <div className="flex flex-wrap gap-2">
            {[...categories, null].map((c) => (
              <button key={c ?? ''} type="button" onClick={() => onMove(c)} className="h-11 rounded-full border border-border px-3.5 text-[13px] font-medium">
                {categoryLabel(c)}
              </button>
            ))}
          </div>
          <label className="block space-y-2">
            <span className="block text-[12px] font-semibold text-muted-foreground">New category</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} className="h-12 text-base" />
          </label>
          <button type="button" disabled={!next} onClick={() => onMove(next)} className="h-12 w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
            Create and move
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

const DeleteSheet = ({ count, onClose, onDelete }: { count: number; onClose: () => void; onDelete: () => void }) => (
  <Drawer open onOpenChange={(open) => !open && onClose()}>
    <DrawerContent className="rounded-t-[26px] border-border bg-card">
      <DrawerTitle className="sr-only">Delete habits</DrawerTitle>
      <div className="space-y-3.5 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
        <div className="font-display text-lg font-semibold tracking-tight text-foreground">Delete {count} {count === 1 ? 'habit' : 'habits'}?</div>
        <p className="text-sm text-muted-foreground">This also erases their history and streaks. It can't be undone.</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="h-12 rounded-full bg-muted text-[15px] font-semibold">Cancel</button>
          <button type="button" onClick={onDelete} className="h-12 rounded-full bg-destructive text-[15px] font-semibold text-destructive-foreground">Delete</button>
        </div>
      </div>
    </DrawerContent>
  </Drawer>
);

interface CategoryEditListProps {
  habits: Habit[]; // all habits, archived too
  onRename: (from: string, to: string | null) => Promise<boolean>;
  onMove: (name: string | null, ids: string[]) => Promise<boolean>;
  onDelete: (ids: string[]) => Promise<boolean>;
}

const CategoryEditList = ({ habits, onRename, onMove, onDelete }: CategoryEditListProps) => {
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [sheet, setSheet] = useState<'move' | 'delete' | null>(null);
  const active = habits.filter((h) => !h.archived_at);
  const names = categoryNames(habits);

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  const toggleGroup = (ids: string[], allOn: boolean) =>
    setPicked((prev) => [...prev.filter((p) => !ids.includes(p)), ...(allOn ? [] : ids)]);
  const finish = (ok: boolean) => {
    setSheet(null);
    if (ok) setPicked([]);
  };

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
      {categoryGroups(active).map(({ name, habits: group }) => {
        const ids = group.map((h) => h.id);
        const allOn = ids.every((id) => picked.includes(id));
        return (
          <section key={name ?? ''} className="space-y-1">
            <div className="flex items-center justify-between px-1">
              <SectionLabel>{categoryLabel(name)}</SectionLabel>
              <button type="button" onClick={() => toggleGroup(ids, allOn)} className="h-11 text-[13px] font-semibold text-primary">
                {allOn ? 'Clear' : 'Select all'}
              </button>
            </div>
            <div className="elevation-card divide-y divide-border rounded-2xl p-0">
              {group.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  role="checkbox"
                  aria-checked={picked.includes(h.id)}
                  onClick={() => toggle(h.id)}
                  className="flex min-h-14 w-full items-center gap-3 px-3 py-1.5 text-left"
                >
                  <HabitTile habit={h} size={34} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{h.name}</span>
                  <Tick on={picked.includes(h.id)} />
                </button>
              ))}
            </div>
          </section>
        );
      })}
      {picked.length > 0 && (
        <div className="elevation-card sticky z-30 flex items-center gap-1.5 rounded-full p-2" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 84px)' }}>
          <span className="flex-1 pl-3 text-sm font-semibold"><span className="font-mono">{picked.length}</span> selected</span>
          <button type="button" onClick={() => setSheet('move')} className="h-11 rounded-full bg-muted px-[18px] text-sm font-semibold">Move</button>
          <button type="button" onClick={() => setSheet('delete')} className="h-11 rounded-full bg-primary px-[18px] text-sm font-semibold text-primary-foreground">Delete</button>
        </div>
      )}
      {adding && <NewCategorySheet habits={active} onClose={() => setAdding(false)} onCreate={onMove} />}
      {sheet === 'move' && (
        <MoveSheet count={picked.length} categories={names} onClose={() => setSheet(null)} onMove={async (name) => finish(await onMove(name, picked))} />
      )}
      {sheet === 'delete' && (
        <DeleteSheet count={picked.length} onClose={() => setSheet(null)} onDelete={async () => finish(await onDelete(picked))} />
      )}
    </div>
  );
};

export default CategoryEditList;
