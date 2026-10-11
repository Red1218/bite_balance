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
