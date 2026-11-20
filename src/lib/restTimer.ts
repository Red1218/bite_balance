// The phone notification when a rest between sets ends, so it reaches you with the app in the background.
import { LocalNotifications } from '@capacitor/local-notifications';
import { remindersSupported } from './habitReminders';

export const REST_NOTIFICATION_ID = 7; // habit reminders use date-based ids (8 digits and up), so no clash

export const scheduleRestEnd = async (at: number, body: string) => {
  if (!remindersSupported()) return;
  try {
    const granted = (await LocalNotifications.checkPermissions()).display === 'granted' || (await LocalNotifications.requestPermissions()).display === 'granted';
    if (!granted) return;
    await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] });
    await LocalNotifications.schedule({
      notifications: [{ id: REST_NOTIFICATION_ID, title: 'Rest over', body, schedule: { at: new Date(at), allowWhileIdle: true }, extra: { route: '/workouts/log' } }],
    });
  } catch (err) {
    console.error('Could not schedule the rest timer:', err);
  }
};

export const cancelRestEnd = () => {
  if (!remindersSupported()) return;
  LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] }).catch((err) => console.error('Could not cancel the rest timer:', err));
};
