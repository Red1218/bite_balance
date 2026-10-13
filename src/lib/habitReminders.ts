// Habit reminders: phone-local notifications. The daily summary setting is kept on this device;
// per-habit times live on each habit.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { reminderSchedule, type Habit, type LogIndex } from './habits';

export interface ReminderSettings {
  enabled: boolean;
  time: string; // 'HH:MM'
}

const STORAGE_KEY = 'checklistReminder'; // kept from the checklist days so the setting carries over
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
  if (!remindersSupported()) return true;
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
export const syncReminders = (habits: Habit[], idx: LogIndex) => {
  if (!remindersSupported()) return queue;
  queue = queue.then(async () => {
    try {
      const { notifications: pending } = await LocalNotifications.getPending();
      if (pending.length) await LocalNotifications.cancel({ notifications: pending.map(({ id }) => ({ id })) });
      const { enabled, time } = getReminderSettings();
      const notices = reminderSchedule(habits, idx, enabled ? time : null, new Date());
      if (notices.length) {
        await LocalNotifications.schedule({
          notifications: notices.map(({ id, at, title, body }) => ({ id, title, body, schedule: { at, allowWhileIdle: true } })),
        });
      }
    } catch (err) {
      console.error('Could not update habit reminders:', err);
    }
  });
  return queue;
};
