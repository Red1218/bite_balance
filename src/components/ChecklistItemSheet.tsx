import { useEffect, useState } from 'react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { ALL_WEEKDAYS, scheduleLabel, type ChecklistItem, type ChecklistItemValues } from '@/lib/checklist';

// Monday-first, matching the rest of the app's calendars.
const WEEKDAY_BUTTONS = [[1, 'M'], [2, 'T'], [3, 'W'], [4, 'T'], [5, 'F'], [6, 'S'], [0, 'S']] as const;

interface ChecklistItemSheetProps {
  open: boolean;
  item: ChecklistItem | null;
  onOpenChange: (open: boolean) => void;
  onSave: (values: ChecklistItemValues) => Promise<boolean>;
  onArchive: (id: string) => Promise<boolean>;
}

const ChecklistItemSheet = ({ open, item, onOpenChange, onSave, onArchive }: ChecklistItemSheetProps) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>(ALL_WEEKDAYS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name ?? '');
    setNote(item?.note ?? '');
    setWeekdays(item?.weekdays ?? ALL_WEEKDAYS);
  }, [open, item]);

  const toggleDay = (d: number) =>
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  const canSave = name.trim().length > 0 && weekdays.length > 0 && !busy;

  // On failure the hook has already shown a toast; the sheet stays open with the typed values.
  const save = async () => {
    setBusy(true);
    const ok = await onSave({ name: name.trim(), note: note.trim() || null, weekdays: [...weekdays].sort((a, b) => a - b) });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const archive = async () => {
    if (!item || !window.confirm(`Archive "${item.name}"? It leaves your daily list; its history is kept.`)) return;
    setBusy(true);
    const ok = await onArchive(item.id);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const title = item ? 'Edit item' : 'New item';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className="space-y-4 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">{title}</div>

          <div className="space-y-2">
            <Label htmlFor="checklist-name" className="text-sm text-foreground">Name</Label>
            <Input id="checklist-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vitamin D" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="checklist-note" className="text-sm text-foreground">
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input id="checklist-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="2000 IU, after lunch" className="h-11 rounded-xl" />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-foreground">Repeat on</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {weekdays.length === 0 ? 'pick at least one day' : scheduleLabel(weekdays)}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_BUTTONS.map(([d, label]) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={weekdays.includes(d)}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    'h-10 rounded-xl text-xs font-semibold transition-colors',
                    weekdays.includes(d) ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="h-[52px] w-full rounded-[14px] bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
          {item && (
            <button type="button" onClick={archive} disabled={busy} className="h-11 w-full rounded-[14px] text-sm font-medium text-primary">
              Archive
            </button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ChecklistItemSheet;
