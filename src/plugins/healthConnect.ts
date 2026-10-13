import { registerPlugin } from '@capacitor/core';
import { Health } from '@capgo/capacitor-health';
import { fmtLocalDate } from '@/lib/utils';

// Our own HealthConnectPlugin.java: permissions for every type we read, plus the watch's
// total-calorie records, which capgo can't read (OHealth writes those, never active calories).
const Native = registerPlugin<{
  hasAccess(): Promise<{ granted: boolean }>;
  requestAccess(): Promise<{ granted: boolean }>;
  getTotalCalories(options: { days: number }): Promise<{ days: Array<{ date: string; kcal: number }> }>;
}>('HealthConnect');

type DataType = 'steps' | 'calories';

// Sum of every `dataType` sample recorded on the local day containing `day`.
const sumDay = async (dataType: DataType, day: Date) => {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  const { samples } = await Health.readSamples({
    dataType,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    limit: 0, // capgo caps at 100 samples by default; a watch writes far more per day
  });
  return (samples ?? []).reduce((sum, s) => sum + (s.value as number), 0);
};

// Per-day totals for the last `days` days, oldest first (today is last).
const lastDays = async (dataType: DataType, days: number) => {
  const totals = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    totals.push({ date: fmtLocalDate(d), value: await sumDay(dataType, d) });
  }
  return totals;
};

const HealthConnect = {
  async checkPermissions(): Promise<{ granted: boolean }> {
    try {
      return await Native.hasAccess();
    } catch (error) {
      console.error('Failed to check Health Connect permissions:', error);
      return { granted: false };
    }
  },

  async requestPermissions(): Promise<{ granted: boolean }> {
    try {
      return await Native.requestAccess();
    } catch (error) {
      console.error('Failed to request Health Connect permissions:', error);
      return { granted: false };
    }
  },

  async getStepsForDays(days: number): Promise<Array<{ steps: number; date: string }>> {
    try {
      return (await lastDays('steps', days)).map(({ date, value }) => ({ steps: value, date }));
    } catch (error) {
      console.error('Failed to get steps:', error);
      return [];
    }
  },

  // Active calories per day; falls back to the summed total-calorie records for watches that only
  // write those (OHealth logs one per moving minute, so the sum is its own "Calories" figure).
  // ponytail: a source writing round-the-clock total records would count resting burn as active.
  async getCaloriesForDays(days: number): Promise<Array<{ activeCalories: number; date: string }>> {
    try {
      const [active, { days: totals }] = await Promise.all([lastDays('calories', days), Native.getTotalCalories({ days })]);
      return active.map(({ date, value }) => ({
        activeCalories: value || (totals.find((t) => t.date === date)?.kcal ?? 0),
        date,
      }));
    } catch (error) {
      console.error('Failed to get calories:', error);
      return [];
    }
  },
};

export default HealthConnect;
