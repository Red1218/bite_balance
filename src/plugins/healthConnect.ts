import { Health } from '@capgo/capacitor-health';
import { fmtLocalDate } from '@/lib/utils';

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
      const result = await Health.checkAuthorization({ read: ['steps', 'calories'] });
      return { granted: result.readAuthorized.includes('steps') && result.readAuthorized.includes('calories') };
    } catch (error) {
      console.error('Failed to check Health Connect permissions:', error);
      return { granted: false };
    }
  },

  async requestPermissions(): Promise<{ granted: boolean }> {
    try {
      await Health.requestAuthorization({ read: ['steps', 'calories'] });
      return { granted: true };
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

  // capgo reports active energy only; total adds a rough 1500 kcal BMR for display.
  async getCaloriesForDays(
    days: number
  ): Promise<Array<{ activeCalories: number; totalCalories: number; date: string }>> {
    try {
      return (await lastDays('calories', days)).map(({ date, value }) => ({
        activeCalories: value,
        totalCalories: value + 1500,
        date,
      }));
    } catch (error) {
      console.error('Failed to get calories:', error);
      return [];
    }
  },
};

export default HealthConnect;
