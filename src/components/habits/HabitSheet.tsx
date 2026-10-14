import { useEffect, useState, type ReactNode } from 'react';
import { Check, Minus, Plus, X } from 'lucide-react';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  ALL_WEEKDAYS, CATEGORIES, COLORS, TIMES_OF_DAY, scheduleLabel,
  type Habit, type HabitKind, type HabitSchedule, type HabitValues,
} from '@/lib/habits';
import { getReminderSettings, requestReminderPermission } from '@/lib/habitReminders';
import { CATEGORY_LABEL, ICONS, ICON_KEYS, TIME_LABEL, colorStyle } from './habitUi';

// Monday-first, matching the rest of the app's calendars.
const WEEKDAY_BUTTONS = [[1, 'M', 'Monday'], [2, 'T', 'Tuesday'], [3, 'W', 'Wednesday'], [4, 'T', 'Thursday'], [5, 'F', 'Friday'], [6, 'S', 'Saturday'], [0, 'S', 'Sunday']] as const;

export const BLANK_HABIT: HabitValues = {
  name: '', note: null, weekdays: ALL_WEEKDAYS, kind: 'check', target: 1, unit: null, schedule: 'weekdays',
  per_week: 3, interval_days: 2, icon: 'check', color: 'violet', category: null, time_of_day: 'anytime', reminder_times: [],
};

const valuesOf = (habit: Habit): HabitValues => ({
  name: habit.name, note: habit.note, weekdays: habit.weekdays, kind: habit.kind, target: habit.target, unit: habit.unit,
  schedule: habit.schedule, per_week: habit.per_week ?? 3, interval_days: habit.interval_days ?? 2, icon: habit.icon,
  color: habit.color, category: habit.category, time_of_day: habit.time_of_day, reminder_times: habit.reminder_times,
});

const Field = ({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) => (
  <div className="space-y-2">
    {htmlFor ? (
      <label htmlFor={htmlFor} className="block font-sans text-[12px] font-semibold text-muted-foreground">{label}</label>
    ) : (
      <div className="font-sans text-[12px] font-semibold text-muted-foreground">{label}</div>
    )}
    {children}
  </div>
);

const Segmented = <T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) => (
  <div role="radiogroup" aria-label={label} className="flex h-11 rounded-full bg-muted p-[3px]">
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={cn(
          'flex-1 whitespace-nowrap rounded-full px-1.5 text-[13px] font-semibold transition-colors',
          value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        )}
      >
        {text}
      </button>
    ))}
  </div>
);

const Chip = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    aria-pressed={on}
    onClick={onClick}
    className={cn('h-11 rounded-full border px-3.5 text-[13px] font-medium', on ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground')}
  >
    {children}
  </button>
);

const Stepper = ({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) => (
  <div className="flex items-center gap-2">
    <button type="button" aria-label={`Lower ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted disabled:opacity-40">
      <Minus className="h-4 w-4" strokeWidth={2.6} />
    </button>
    <input
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      className="h-11 w-16 rounded-xl border border-input bg-background text-center font-mono text-lg font-semibold"
    />
    <button type="button" aria-label={`Raise ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="flex h-11 w-11 items-center justify-center rounded-full bg-muted disabled:opacity-40">
      <Plus className="h-4 w-4" strokeWidth={2.6} />
    </button>
  </div>
);

interface HabitSheetProps {
  open: boolean;
  habit: Habit | null; // null = new
  onOpenChange: (open: boolean) => void;
  onSave: (values: HabitValues) => Promise<unknown>;
}

const HabitSheet = ({ open, habit, onOpenChange, onSave }: HabitSheetProps) => {
  const { toast } = useToast();
  const [v, setV] = useState<HabitValues>(BLANK_HABIT);
  const [newTime, setNewTime] = useState('09:00');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<HabitValues>) => setV((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    if (open) setV(habit ? valuesOf(habit) : BLANK_HABIT);
  }, [open, habit]);

  const setKind = (kind: HabitKind) =>
    set({ kind, target: kind === 'count' ? Math.max(v.target, 2) : 1, schedule: kind === 'avoid' && v.schedule === 'per_week' ? 'weekdays' : v.schedule });
  const toggleDay = (d: number) => set({ weekdays: v.weekdays.includes(d) ? v.weekdays.filter((x) => x !== d) : [...v.weekdays, d] });
  const reminders = v.reminder_times;

  const setRemindersOn = async (on: boolean) => {
    if (on && !(await requestReminderPermission())) {
      toast({ title: 'Notifications are blocked', description: 'Allow notifications for Bite Balance in Android settings, then try again.', variant: 'destructive' });
      return;
    }
    set({ reminder_times: on ? [newTime] : [] });
  };
  const addTime = () => {
    if (!reminders.includes(newTime) && reminders.length < 5) set({ reminder_times: [...reminders, newTime].sort() });
  };

  const canSave = v.name.trim().length > 0 && (v.schedule !== 'weekdays' || v.weekdays.length > 0) && !busy;

  // On failure the hook has already shown a toast; the sheet stays open with the typed values.
  const save = async () => {
    setBusy(true);
    const ok = await onSave({
      ...v,
      name: v.name.trim(),
      note: v.note?.trim() || null,
      unit: v.kind === 'count' ? v.unit?.trim() || null : null,
      target: v.kind === 'count' ? v.target : 1,
      weekdays: [...v.weekdays].sort((a, b) => a - b),
      per_week: v.schedule === 'per_week' ? v.per_week : null,
      interval_days: v.schedule === 'interval' ? v.interval_days : null,
    });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  const title = habit ? 'Edit habit' : 'New habit';
  const daily = getReminderSettings();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94vh] rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">{title}</DrawerTitle>
        <div className="flex items-center px-2.5">
          <button type="button" aria-label="Close" onClick={() => onOpenChange(false)} className="flex h-11 w-11 items-center justify-center rounded-full">
            <X className="h-5 w-5" />
          </button>
          <div className="flex-1 text-center font-display text-lg font-semibold tracking-tight text-foreground">{title}</div>
          <span className="w-11" />
        </div>

        <div className="space-y-[22px] overflow-y-auto px-5 pb-4 pt-2">
          <Field label="Name" htmlFor="habit-name">
            <Input id="habit-name" value={v.name} onChange={(e) => set({ name: e.target.value })} placeholder="Drink water" className="h-12 rounded-xl text-[15px]" />
          </Field>

          <Field label="Icon">
            <div className="grid grid-cols-8 gap-1.5">
              {ICON_KEYS.map((key) => {
                const Icon = ICONS[key];
                const on = v.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    aria-pressed={on}
                    onClick={() => set({ icon: key })}
                    style={colorStyle(v.color)}
                    className={cn('flex h-11 items-center justify-center rounded-xl border', on ? 'habit-tint border-2 border-current' : 'border-border text-foreground')}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Color">
            <div className="flex gap-3.5 pl-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={color}
                  aria-pressed={v.color === color}
                  onClick={() => set({ color })}
                  style={{ ...colorStyle(color), background: 'var(--c)', boxShadow: v.color === color ? '0 0 0 3px hsl(var(--card)), 0 0 0 5px var(--c)' : undefined }}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                >
                  {v.color === color && <Check className="h-[18px] w-[18px]" strokeWidth={3} />}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Type">
            <Segmented label="Habit type" value={v.kind} onChange={setKind} options={[['check', 'Yes / no'], ['count', 'Count'], ['avoid', 'Avoid']]} />
            {v.kind === 'count' && (
              <div className="flex items-center gap-2.5 pt-1.5">
                <Stepper label="daily target" value={v.target} min={1} max={100000} onChange={(target) => set({ target })} />
                <Input aria-label="Unit" value={v.unit ?? ''} onChange={(e) => set({ unit: e.target.value })} placeholder="glasses" className="h-11 flex-1 rounded-xl" />
                <span className="text-[13px] text-muted-foreground">/ day</span>
              </div>
            )}
            {v.kind === 'avoid' && <p className="text-xs text-muted-foreground">Mark Held or Slipped each evening. Days you don't mark count as held.</p>}
          </Field>

          <Field label="Schedule">
            <Segmented<HabitSchedule>
              label="Schedule"
              value={v.schedule}
              onChange={(schedule) => set({ schedule })}
              options={v.kind === 'avoid' ? [['weekdays', 'Weekdays'], ['interval', 'Every N days']] : [['weekdays', 'Weekdays'], ['per_week', '× per week'], ['interval', 'Every N days']]}
            />
            <div className="pt-1.5">
              {v.schedule === 'weekdays' && (
                <div className="grid grid-cols-7 gap-1.5">
                  {WEEKDAY_BUTTONS.map(([d, short, full]) => (
                    <button
                      key={d}
                      type="button"
                      aria-label={full}
                      aria-pressed={v.weekdays.includes(d)}
                      onClick={() => toggleDay(d)}
                      className={cn('h-11 rounded-xl border font-mono text-[13px] font-semibold', v.weekdays.includes(d) ? 'border-foreground bg-foreground text-background' : 'border-border text-foreground')}
                    >
                      {short}
                    </button>
                  ))}
                </div>
              )}
              {v.schedule === 'per_week' && <Stepper label="times per week" value={v.per_week ?? 3} min={1} max={7} onChange={(per_week) => set({ per_week })} />}
              {v.schedule === 'interval' && <Stepper label="days between" value={v.interval_days ?? 2} min={2} max={60} onChange={(interval_days) => set({ interval_days })} />}
            </div>
            <p className="text-xs text-muted-foreground">
              {v.schedule === 'weekdays' && v.weekdays.length === 0 ? 'Pick at least one day.' : `${scheduleLabel(v)}. Skipped days never break the streak.`}
            </p>
          </Field>

          <Field label="Time of day">
            <div className="flex flex-wrap gap-2">
              {TIMES_OF_DAY.map((t) => <Chip key={t} on={v.time_of_day === t} onClick={() => set({ time_of_day: t })}>{TIME_LABEL[t]}</Chip>)}
            </div>
          </Field>

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => <Chip key={c} on={v.category === c} onClick={() => set({ category: v.category === c ? null : c })}>{CATEGORY_LABEL[c]}</Chip>)}
            </div>
          </Field>

          <div className="space-y-2.5">
            <label className="flex items-center justify-between gap-3">
              <span className="text-[15px] font-medium text-foreground">Reminders for this habit</span>
              <Switch checked={reminders.length > 0} onCheckedChange={setRemindersOn} aria-label="Reminders for this habit" />
            </label>
            {reminders.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {reminders.map((t) => (
                  <span key={t} className="flex h-11 items-center gap-1 rounded-full border border-border pl-3.5 pr-1 font-mono text-[13px]">
                    {t}
                    <button type="button" aria-label={`Remove ${t}`} onClick={() => set({ reminder_times: reminders.filter((x) => x !== t) })} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground">
                      <X className="h-3.5 w-3.5" strokeWidth={2.6} />
                    </button>
                  </span>
                ))}
                {reminders.length < 5 && (
                  <span className="flex h-11 items-center gap-1 rounded-full border border-dashed border-border pl-2 pr-1">
                    <input type="time" aria-label="New reminder time" value={newTime} onChange={(e) => e.target.value && setNewTime(e.target.value)} className="bg-transparent font-mono text-[13px]" />
                    <button type="button" aria-label="Add reminder time" onClick={addTime} className="flex h-9 w-9 items-center justify-center rounded-full text-primary">
                      <Plus className="h-4 w-4" strokeWidth={2.6} />
                    </button>
                  </span>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {daily.enabled ? <>Sent in addition to your daily check-in at <span className="font-mono">{daily.time}</span>.</> : 'Only on days the habit is still open.'}
            </p>
          </div>

          <Field label="Note (optional)" htmlFor="habit-note">
            <Input id="habit-note" value={v.note ?? ''} onChange={(e) => set({ note: e.target.value })} placeholder="2000 IU, after lunch" className="h-12 rounded-xl" />
          </Field>
        </div>

        <div className="border-t border-border px-5 pb-[calc(env(safe-area-inset-bottom,0px)+16px)] pt-4">
          <button type="button" onClick={save} disabled={!canSave} className="h-[52px] w-full rounded-full bg-primary text-[15px] font-semibold text-primary-foreground disabled:opacity-50">
            {busy ? 'Saving…' : 'Save habit'}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default HabitSheet;
