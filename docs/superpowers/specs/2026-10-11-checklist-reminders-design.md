# Checklist reminders — design

**Date:** 2026-10-11 · **Status:** approved in chat, awaiting spec review

## Goal

One daily phone notification at a time you pick, listing the checklist items still to do that day.
No notification when everything due is ticked or nothing is due.

## Decisions

| Question | Decision |
|---|---|
| Reminder style | One daily summary at a chosen time. No per-item times. |
| Where it's set | Bell button on the Checklist page → small sheet: on/off switch + time (default 20:00). |
| Where the setting lives | `localStorage` on the phone (reminders fire from this phone, so the setting is per device). |
| Platform | Native app only; the bell is hidden in the browser (`Capacitor.isNativePlatform()`). |
| Timing precision | Exact: `USE_EXACT_ALARM` in the app manifest (inexact alarms were up to 1 h late on the phone). Play Store policy limits it to alarm/calendar apps; fine while sideloaded. |

## How it works

Notifications are local: scheduled on the phone, no server. The phone only knows the checklist as of the
last time the app had it loaded, so the schedule is rebuilt from scratch whenever that data changes.

- **Window:** the next 7 days (today + 6). One notification per day at the chosen time.
- **Today:** lists the items due today and not yet ticked. Skipped if the time has passed, all are ticked, or none are due.
- **Future days:** lists every item due that day (none can be ticked yet). Skipped if nothing is due.
- **Text:** title `Checklist`; body `2 left today: Vitamin D, Magnesium` (today) or `3 to do today: Vitamin D, Creatine, Magnesium`
  (future days). Names in the items' saved order.
- **Ids:** the date as a number (`20261011`), so each day has one stable slot.
- **Rebuild:** cancel every pending notification, then schedule the new list. Only this feature uses notifications, so
  cancelling all pending is safe.
- **Expiry:** if the app isn't opened for 7 days, reminders run out; opening it schedules the next 7.
- **Tap:** opens the app on `/checklist`.

## Components

- `@capacitor/local-notifications` (v7, matching the other Capacitor plugins). Its manifest merge adds
  `POST_NOTIFICATIONS`; Android 13+ asks at runtime.
- **`src/lib/checklist.ts`** — pure `reminderSchedule(items, checks, time, now)` →
  `{ id, at: Date, body }[]`. No Capacitor import, so `npm run check:checklist` covers it.
- **`src/lib/checklistReminder.ts`** — the native side:
  - `getReminderSettings()` / `saveReminderSettings({ enabled, time })` (localStorage, wrapped in try/catch, default `{ enabled: false, time: '20:00' }`)
  - `syncReminders(items, checks)` — cancel pending; if enabled and native, schedule `reminderSchedule(...)`
  - `requestReminderPermission()` — requests permission; returns `false` if denied
- **`useChecklist`** — an effect calls `syncReminders(items, checks)` after a successful load and whenever
  `items`/`checks` change. Both callers (Today card: today only; Checklist page: up to today) include today's ticks.
- **`ChecklistReminderSheet.tsx`** — vaul Drawer like `ChecklistItemSheet`: `Switch` + `<input type="time">`.
  Turning on calls `requestReminderPermission()`; on denial the switch stays off and a toast explains how to allow
  notifications in Android settings. Any change saves settings and calls `syncReminders`.
- **`Checklist.tsx`** — `Bell` icon button next to Add (native only), filled/primary when on.
- **`AppRoutes` in `App.tsx`** (inside `BrowserRouter`) — `localNotificationActionPerformed` listener → `navigate('/checklist')`.

## Error handling

- Permission denied → switch off, toast; nothing scheduled.
- Plugin call fails → `console.error`, no toast (a reminder failing must not block ticking).
- Checklist failed to load → don't touch the schedule (keep the last good one).

## Testing

- `npm run check:checklist`: today with some ticked / all ticked / time passed; future day lists all due;
  off-schedule and archived items excluded; 7 entries max; ids are the date numbers.
- On the phone: set the time 2 minutes ahead → notification shows the right items; tick everything →
  pending notification for today is gone (`dumpsys notification` / `getPending`); tap → Checklist opens.
  Restore the reminder setting and any test ticks afterwards.

## Out of scope

Per-item reminder times, snooze/actions on the notification, server push.
