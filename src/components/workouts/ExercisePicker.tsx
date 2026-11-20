import { useEffect, useMemo, useState } from 'react';
import { Check, Dumbbell, Plus, Search } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { closeOnBack } from '@/lib/backButton';
import { cn } from '@/lib/utils';
import {
  BODY_PARTS, BODY_PART_LABEL, EQUIPMENT, EQUIPMENT_LABEL, KINDS, KIND_KEYS,
  type BodyPart, type Equipment, type Exercise, type ExerciseKind,
} from '@/lib/workouts';
import { Chip, partStyle, tintBg, tintInk } from './workoutUi';

interface CreateFormProps {
  initialName: string;
  onCancel: () => void;
  onCreate: (values: Omit<Exercise, 'id' | 'user_id'>) => Promise<Exercise | null>;
}

const CreateForm = ({ initialName, onCancel, onCreate }: CreateFormProps) => {
  const [name, setName] = useState(initialName);
  const [part, setPart] = useState<BodyPart | null>(null);
  const [secondary, setSecondary] = useState<BodyPart[]>([]);
  const [equipment, setEquipment] = useState<Equipment>('barbell');
  const [kind, setKind] = useState<ExerciseKind>('weight_reps');
  const [saving, setSaving] = useState(false);
  const ready = name.trim() && part && !saving;

  const save = async () => {
    if (!part) return;
    setSaving(true);
    const saved = await onCreate({ name: name.trim(), body_part: part, secondary: secondary.filter((s) => s !== part), equipment, kind });
    setSaving(false);
    if (saved) onCancel();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="font-display text-xl font-semibold tracking-tight">New exercise</div>
        <button type="button" onClick={onCancel} className="h-11 px-2 text-sm font-semibold text-muted-foreground">Cancel</button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <label className="block space-y-2">
          <span className="block text-[12px] font-semibold text-muted-foreground">Name</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="h-12 text-base" />
        </label>
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-muted-foreground">Body part</div>
          <div className="flex flex-wrap gap-1.5">
            {BODY_PARTS.map(([p, label]) => (
              <Chip key={p} on={part === p} onClick={() => setPart(p)}>{label}</Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-muted-foreground">Secondary muscles</div>
          <div className="flex flex-wrap gap-1.5">
            {BODY_PARTS.filter(([p]) => p !== part).map(([p, label]) => (
              <Chip key={p} on={secondary.includes(p)} onClick={() => setSecondary((prev) => (prev.includes(p) ? prev.filter((s) => s !== p) : [...prev, p]))}>
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-[12px] font-semibold text-muted-foreground">Equipment</div>
          <div className="flex flex-wrap gap-1.5">
            {EQUIPMENT.map(([e, label]) => (
              <Chip key={e} on={equipment === e} onClick={() => setEquipment(e)}>{label}</Chip>
            ))}
          </div>
        </div>
        <div role="radiogroup" aria-label="Exercise type" className="space-y-2">
          <div className="text-[12px] font-semibold text-muted-foreground">Exercise type</div>
          <div className="grid grid-cols-2 gap-1.5">
            {KIND_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  'flex min-h-[52px] flex-col items-start justify-center rounded-2xl border px-3 py-1.5 text-left',
                  kind === k ? 'border-2 border-primary bg-muted' : 'border-border'
                )}
              >
                <span className="text-[13px] font-semibold">{KINDS[k].label}</span>
                <span className="text-[11px] text-muted-foreground">{KINDS[k].heads.join(' · ')}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <button type="button" disabled={!ready} onClick={save} className="h-14 w-full flex-none rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50">
        Save exercise
      </button>
    </>
  );
};

interface ExercisePickerProps {
  open: boolean;
  exercises: Exercise[];
  onOpenChange: (open: boolean) => void;
  onAdd: (ids: string[]) => void;
  onCreate: (values: Omit<Exercise, 'id' | 'user_id'>) => Promise<Exercise | null>;
}

const ExercisePicker = ({ open, exercises, onOpenChange, onAdd, onCreate }: ExercisePickerProps) => {
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<BodyPart | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter(
      (e) => (!q || e.name.toLowerCase().includes(q)) && (!part || e.body_part === part) && (!equipment || e.equipment === equipment)
    );
  }, [exercises, query, part, equipment]);

  const close = (next: boolean) => {
    if (!next) {
      setPicked([]);
      setCreating(false);
      setQuery('');
    }
    onOpenChange(next);
  };

  // Android Back first drops the keyboard (keeping the picks), then leaves the new-exercise form, then
  // closes the picker, instead of leaving the workout. Re-registers each render to see the current state.
  useEffect(() =>
    open
      ? closeOnBack(() => {
          const typing = document.activeElement;
          if (typing instanceof HTMLInputElement || typing instanceof HTMLTextAreaElement) typing.blur();
          else if (creating) setCreating(false);
          else close(false);
        })
      : undefined
  );

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerContent className="h-[92vh] rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">{creating ? 'New exercise' : 'Add exercises'}</DrawerTitle>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-3">
          {creating ? (
            <CreateForm
              initialName={query.trim()}
              onCancel={() => setCreating(false)}
              onCreate={async (values) => {
                const saved = await onCreate(values);
                if (saved) {
                  setPicked((prev) => [...prev, saved.id]);
                  setQuery('');
                  setPart(null);
                  setEquipment(null);
                }
                return saved;
              }}
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="font-display text-xl font-semibold tracking-tight">Add exercises</div>
                <button type="button" onClick={() => setCreating(true)} className="flex h-11 items-center gap-1 rounded-full bg-muted px-3.5 text-sm font-semibold text-primary">
                  <Plus className="h-4 w-4" strokeWidth={2.6} /> Create
                </button>
              </div>
              <label className="flex h-12 flex-none items-center gap-2.5 rounded-full bg-muted px-4">
                <Search className="h-[18px] w-[18px] text-muted-foreground" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search exercises"
                  aria-label="Search exercises"
                  className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
              </label>
              <div className="-mx-4 flex flex-none gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
                {BODY_PARTS.map(([p, label]) => (
                  <Chip key={p} on={part === p} onClick={() => setPart(part === p ? null : p)}>{label}</Chip>
                ))}
              </div>
              <div className="-mx-4 flex flex-none gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]">
                {EQUIPMENT.map(([e, label]) => (
                  <Chip key={e} on={equipment === e} onClick={() => setEquipment(equipment === e ? null : e)} className="rounded-xl">{label}</Chip>
                ))}
              </div>
              <div className="-mx-1 min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                {shown.map((e) => {
                  const on = picked.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => setPicked((prev) => (on ? prev.filter((p) => p !== e.id) : [...prev, e.id]))}
                      className="flex min-h-[60px] w-full items-center gap-3 px-1 text-left"
                    >
                      <span style={partStyle(e.body_part)} className={cn('flex h-10 w-10 flex-none items-center justify-center rounded-xl', tintBg, tintInk)}>
                        <Dumbbell className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold">{e.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {BODY_PART_LABEL[e.body_part]} · {EQUIPMENT_LABEL[e.equipment]}
                          {e.user_id && ' · Yours'}
                        </span>
                      </span>
                      <span className={cn('flex h-6 w-6 flex-none items-center justify-center rounded-lg border-2', on ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/45')}>
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3.2} />}
                      </span>
                    </button>
                  );
                })}
                {shown.length === 0 && (
                  <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
                    <p>No exercise matches.</p>
                    <button type="button" onClick={() => setCreating(true)} className="h-11 rounded-full bg-muted px-4 font-semibold text-foreground">
                      Create {query.trim() ? `“${query.trim()}”` : 'an exercise'}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={!picked.length}
                onClick={() => {
                  onAdd(picked);
                  close(false);
                }}
                className="h-14 w-full flex-none rounded-full bg-primary text-base font-semibold text-primary-foreground disabled:opacity-50"
              >
                {picked.length ? `Add ${picked.length} ${picked.length === 1 ? 'exercise' : 'exercises'}` : 'Pick exercises'}
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ExercisePicker;
