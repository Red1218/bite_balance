# Checklist Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One daily local notification at a user-chosen time listing the checklist items still to do that day.

**Architecture:** A pure function in `src/lib/checklist.ts` turns items + ticks + time into the next 7 days of notices. A thin native module (`src/lib/checklistReminder.ts`) stores the setting in localStorage and rebuilds the pending notifications via `@capacitor/local-notifications`; `useChecklist` calls it whenever its data changes. A bell button on the Checklist page opens a sheet to set it.

**Tech Stack:** React 18 + TS + Vite, Capacitor 7 Android, `@capacitor/local-notifications@^7.0.7`, vaul Drawer, Radix Switch.

**Spec:** `docs/superpowers/specs/2026-10-11-checklist-reminders-design.md`

## Global Constraints

- Do NOT commit, push or merge — the user commits on request ("commit this"). Work on a feature branch `checklist-reminders` cut from `main`.
- Dates are local `YYYY-MM-DD` (`fmtLocalDate` in `src/lib/utils.ts`); never `toISOString().split('T')[0]`.
- Tailwind semantic tokens only (`bg-primary`, `text-muted-foreground`, …); no hex literals; must work in light and dark.
- Native-only UI: gate on `Capacitor.isNativePlatform()`.
- Baselines: `npx tsc --noEmit -p tsconfig.app.json` stays at 17 errors (all in untouched files); `npx eslint` shows no new errors.
- Every change is verified on the phone (adb `R9ZYA00X9HW`, package `com.bite_balance.app`); restore settings/test data; leave the app on the Today tab. Check the foreground app before every tap.

---

### Task 1: `reminderSchedule` (pure) + self-check

**Files:**
- Modify: `src/lib/checklist.ts` (append)
- Test: `src/lib/checklist.check.ts` (append before the final `if (failures)`)

**Interfaces:**
- Produces: `REMINDER_DAYS = 7`; `interface ReminderNotice { id: number; at: Date; body: string }`;
  `reminderSchedule(items: ChecklistItem[], checks: ChecklistCheck[], time: string /* 'HH:MM' */, now: Date): ReminderNotice[]`

- [ ] **Step 1: Write the failing checks** — append to `src/lib/checklist.check.ts`, and add `reminderSchedule` to its import from `./checklist`:

```ts
// Reminders. "Now" is Tue 29 Sep 18:00 IST. A daily, B Mondays, C archived 1 Oct (last due 30 Sep).
const NOW = new Date(2026, 8, 29, 18, 0);
const rA = item({ id: 'a', name: 'A' });
const rB = item({ id: 'b', name: 'B', weekdays: [1] });
const rC = item({ id: 'c', name: 'C', archived_at: '2026-10-01T06:00:00Z' });
const brief = (list: { id: number; at: Date; body: string }[]) => list.map((n) => `${n.id} ${n.at.getHours()}:${n.at.getMinutes()} ${n.body}`);

eq(
  brief(reminderSchedule([rA, rB, rC], ticks('a', ['2026-09-29']), '20:00', NOW)),
  [
    '20260929 20:0 1 left today: C',
    '20260930 20:0 2 to do today: A, C',
    '20261001 20:0 1 to do today: A',
    '20261002 20:0 1 to do today: A',
    '20261003 20:0 1 to do today: A',
    '20261004 20:0 1 to do today: A',
    '20261005 20:0 2 to do today: A, B',
  ],
  'reminders: 7 days, unticked only today, archived and off-schedule items left out'
);
eq(reminderSchedule([rA], [], '17:30', NOW)[0].id, 20260930, 'reminders: time already passed today -> starts tomorrow');
eq(reminderSchedule([rA], ticks('a', ['2026-09-29']), '20:00', NOW)[0].id, 20260930, 'reminders: all ticked today -> none today');
eq(reminderSchedule([rB], [], '20:00', NOW).map((n) => n.id), [20261005], 'reminders: only days with something due');
eq(reminderSchedule([], [], '20:00', NOW), [], 'reminders: no items -> nothing');
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run check:checklist`
Expected: esbuild error — `No matching export in "src/lib/checklist.ts" for import "reminderSchedule"`.

- [ ] **Step 3: Implement** — append to `src/lib/checklist.ts`:

```ts
export const REMINDER_DAYS = 7;

export interface ReminderNotice {
  id: number; // the day as a number, e.g. 20261011 -- one slot per day
  at: Date;
  body: string;
}

// The next REMINDER_DAYS daily reminders at `time` ('HH:MM'), from `now`. Today lists what's still
// unticked; later days list everything due. Days with nothing left, or a time already past, are skipped.
export const reminderSchedule = (items: ChecklistItem[], checks: ChecklistCheck[], time: string, now: Date) => {
  const [hours, minutes] = time.split(':').map(Number);
  const today = fmtLocalDate(now);
  const notices: ReminderNotice[] = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const date = addDays(today, i);
    const at = localDay(date);
    at.setHours(hours, minutes);
    if (at <= now) continue;
    const left = items.filter((item) => isDue(item, date) && !isChecked(checks, item.id, date));
    if (!left.length) continue;
    const names = left.map((item) => item.name).join(', ');
    notices.push({ id: Number(date.replace(/-/g, '')), at, body: `${left.length} ${i === 0 ? 'left' : 'to do'} today: ${names}` });
  }
  return notices;
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run check:checklist`
Expected: `checklist: all checks passed`

---

### Task 2: Native reminder module, auto-sync and tap-to-open

**Files:**
- Modify: `package.json` (dependency via npm)
- Create: `src/lib/checklistReminder.ts`
- Modify: `src/hooks/useChecklist.ts` (one effect)
- Modify: `src/hooks/useNativeApp.ts` (tap listener)

**Interfaces:**
- Consumes: `reminderSchedule`, `ChecklistItem`, `ChecklistCheck` from `@/lib/checklist` (Task 1).
- Produces (from `@/lib/checklistReminder`): `interface ReminderSettings { enabled: boolean; time: string }`;
  `remindersSupported(): boolean`; `getReminderSettings(): ReminderSettings`; `saveReminderSettings(s: ReminderSettings): void`;
  `requestReminderPermission(): Promise<boolean>`; `syncReminders(items: ChecklistItem[], checks: ChecklistCheck[]): Promise<void>`.

- [ ] **Step 1: Install the plugin**

Run: `npm install @capacitor/local-notifications@^7.0.7`
Expected: `package.json` gains `"@capacitor/local-notifications": "^7.0.7"`.

- [ ] **Step 2: Create `src/lib/checklistReminder.ts`**

```ts
// Daily checklist reminder: phone-local notifications, setting kept on this device.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderSchedule, type ChecklistCheck, type ChecklistItem } from './checklist';

export interface ReminderSettings {
  enabled: boolean;
  time: string; // 'HH:MM'
}

const STORAGE_KEY = 'checklistReminder';
const DEFAULT_SETTINGS: ReminderSettings = { enabled: false, time: '20:00' };

export const remindersSupported = () => Capacitor.isNativePlatform();

export const getReminderSettings = (): ReminderSettings => {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveReminderSettings = (settings: ReminderSettings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Could not save reminder settings:', err);
  }
};

export const requestReminderPermission = async () => {
  try {
    return (await LocalNotifications.requestPermissions()).display === 'granted';
  } catch (err) {
    console.error('Notification permission request failed:', err);
    return false;
  }
};

// Rebuild = cancel every pending notification (nothing else in the app uses them), then schedule
// the next week. Calls are chained so a quick tick-untick can't interleave two rebuilds.
let queue = Promise.resolve();
export const syncReminders = (items: ChecklistItem[], checks: ChecklistCheck[]) => {
  if (!remindersSupported()) return queue;
  queue = queue.then(async () => {
    try {
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(({ id }) => ({ id })) });
      const { enabled, time } = getReminderSettings();
      if (!enabled) return;
      const notices = reminderSchedule(items, checks, time, new Date());
      if (notices.length) {
        await LocalNotifications.schedule({
          notifications: notices.map(({ id, at, body }) => ({ id, title: 'Checklist', body, schedule: { at, allowWhileIdle: true } })),
        });
      }
    } catch (err) {
      console.error('Could not update checklist reminders:', err);
    }
  });
  return queue;
};
```

- [ ] **Step 3: Sync from `useChecklist`** — in `src/hooks/useChecklist.ts` add the import
`import { syncReminders } from '@/lib/checklistReminder';` and, right after the `useEffect(() => { load(); }, [load]);` block:

```ts
  // Keep the phone's reminders in step with the latest ticks; a failed load keeps the last good schedule.
  useEffect(() => {
    if (!loading && !error) syncReminders(items, checks);
  }, [items, checks, loading, error]);
```

- [ ] **Step 4: Tap opens Checklist** — in `src/hooks/useNativeApp.ts`:
  - imports: `import { useNavigate } from 'react-router-dom';` and `import { LocalNotifications } from '@capacitor/local-notifications';`
  - first line of the hook body: `const navigate = useNavigate();`
  - inside `initNativeHooks`, after the Keyboard listeners:

```ts
      // 4. Tapping a checklist reminder opens the Checklist page
      LocalNotifications.addListener('localNotificationActionPerformed', () => navigate('/checklist'));
```
  - in the cleanup, next to `Keyboard.removeAllListeners();`: `LocalNotifications.removeAllListeners();`

(`useNativeApp` is called from `AppRoutes`, which renders inside `BrowserRouter`, so `useNavigate` is valid.)

- [ ] **Step 5: Verify compile + lint**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → Expected: `17`
Run: `npx eslint src/lib/checklistReminder.ts src/hooks/useChecklist.ts src/hooks/useNativeApp.ts` → Expected: no errors.
Run: `npm run check:checklist` → Expected: `checklist: all checks passed`

---

### Task 3: Bell button + reminder sheet

**Files:**
- Create: `src/components/ChecklistReminderSheet.tsx`
- Modify: `src/pages/Checklist.tsx` (imports, state, header)

**Interfaces:**
- Consumes: `ReminderSettings`, `remindersSupported`, `getReminderSettings`, `saveReminderSettings`, `requestReminderPermission`, `syncReminders` (Task 2).
- Produces: `ChecklistReminderSheet` default export, props `{ open: boolean; onOpenChange: (open: boolean) => void; settings: ReminderSettings; onChange: (next: ReminderSettings) => void }`.

- [ ] **Step 1: Create `src/components/ChecklistReminderSheet.tsx`**

```tsx
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { requestReminderPermission, type ReminderSettings } from '@/lib/checklistReminder';

interface ChecklistReminderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ReminderSettings;
  onChange: (next: ReminderSettings) => void;
}

const ChecklistReminderSheet = ({ open, onOpenChange, settings, onChange }: ChecklistReminderSheetProps) => {
  const { toast } = useToast();

  const setEnabled = async (enabled: boolean) => {
    if (enabled && !(await requestReminderPermission())) {
      toast({
        title: 'Notifications are blocked',
        description: 'Allow notifications for Bite Balance in Android settings, then try again.',
        variant: 'destructive',
      });
      return;
    }
    onChange({ ...settings, enabled });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rounded-t-[26px] border-border bg-card">
        <DrawerTitle className="sr-only">Daily reminder</DrawerTitle>
        <div className="space-y-4 px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">Daily reminder</div>
          <p className="text-sm text-muted-foreground">
            One notification listing what's left. Skipped on days you've ticked everything.
          </p>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Remind me</span>
            <Switch checked={settings.enabled} onCheckedChange={setEnabled} aria-label="Daily reminder" />
          </label>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-foreground">Time</span>
            <input
              type="time"
              value={settings.time}
              onChange={(e) => e.target.value && onChange({ ...settings, time: e.target.value })}
              className="h-11 rounded-xl border border-input bg-background px-3 font-mono text-sm text-foreground"
            />
          </label>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ChecklistReminderSheet;
```

- [ ] **Step 2: Wire it into `src/pages/Checklist.tsx`**
  - icon import: `import { Bell, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';`
  - add imports:

```ts
import ChecklistReminderSheet from '@/components/ChecklistReminderSheet';
import {
  getReminderSettings, remindersSupported, saveReminderSettings, syncReminders, type ReminderSettings,
} from '@/lib/checklistReminder';
```
  - state, next to the other `useState`s: 

```ts
  const [reminder, setReminder] = useState(getReminderSettings);
  const [reminderOpen, setReminderOpen] = useState(false);
```
  - after the `useChecklist(...)` line:

```ts
  const changeReminder = (next: ReminderSettings) => {
    setReminder(next);
    saveReminderSettings(next);
    syncReminders(items, checks);
  };
```
  - replace the header's lone Add `<button>` with a group:

```tsx
        <div className="flex items-center gap-2">
          {remindersSupported() && (
            <button
              type="button"
              onClick={() => setReminderOpen(true)}
              aria-label="Daily reminder"
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full',
                reminder.enabled ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
              )}
            >
              <Bell className={cn('h-4 w-4', reminder.enabled && 'fill-current')} />
            </button>
          )}
          <button
            type="button"
            onClick={() => openSheet(null)}
            className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
```
  - next to the existing `<ChecklistItemSheet … />` render:

```tsx
      <ChecklistReminderSheet open={reminderOpen} onOpenChange={setReminderOpen} settings={reminder} onChange={changeReminder} />
```

- [ ] **Step 3: Verify compile + lint**

Run: `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"` → Expected: `17`
Run: `npx eslint src/components/ChecklistReminderSheet.tsx src/pages/Checklist.tsx` → Expected: no errors.

---

### Task 4: Build and verify on the phone

- [ ] **Step 1: Build + install**

```bash
npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug -q) && adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
Then `adb shell am force-stop com.bite_balance.app && adb shell am start -n com.bite_balance.app/.MainActivity`.
Expected: `npx cap sync` lists `@capacitor/local-notifications@7.0.7`.

- [ ] **Step 2: Turn on** — Checklist page → bell → switch on → Android permission prompt → Allow.
Expected: switch on, bell filled; `adb shell dumpsys alarm | grep -c com.bite_balance.app` > 0.

- [ ] **Step 3: Fires with the right text** — set Time to 2 minutes from now; wait.
Expected: notification "Checklist — N left today: …" listing exactly today's unticked due items in saved order
(`adb shell dumpsys notification --noredact | grep -A3 com.bite_balance.app`).

- [ ] **Step 4: Ticking everything cancels today** — set Time 3 minutes ahead, tick all of today's due items, wait past the time.
Expected: no notification. Untick the test ticks afterwards (DB: `select * from checklist_checks where checked_date = current_date` matches the start state).

- [ ] **Step 5: Tap opens Checklist** — with a notification showing (repeat Step 3), go to Today, tap the notification.
Expected: app opens on the Checklist page.

- [ ] **Step 6: Restore** — set the reminder to the user's wanted state (ask; default: on at 20:00 if they allowed it, else off), clear test notifications, leave the app on Today.
