import { useState, useEffect } from 'react';
import HealthConnect from '@/plugins/healthConnect';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface HealthData {
  steps: number;
  activeCalories: number;
  lastUpdated: string;
  history?: {
    steps: Array<{ steps: number; date: string }>;
    calories: Array<{ activeCalories: number; date: string }>;
  };
}

// Saves each day's steps and calories so the web dashboard can read them (the data otherwise lives
// only on the phone). Several components use this hook and each fetches on mount, so a save that
// matches the last successful one is skipped.
let lastSynced = '';
const syncDaily = async (
  userId: string,
  steps: Array<{ steps: number; date: string }>,
  calories: Array<{ activeCalories: number; date: string }>
) => {
  const rows = steps
    .map((s) => ({
      user_id: userId,
      logged_date: s.date,
      steps: Math.round(s.steps),
      burned_kcal: Math.round((calories.find((c) => c.date === s.date)?.activeCalories ?? 0) * 10) / 10,
    }))
    // A day with nothing read (watch not synced yet) never overwrites a saved day with zeros.
    .filter((r) => r.steps > 0 || r.burned_kcal > 0);
  const key = JSON.stringify([userId, rows]);
  if (!rows.length || key === lastSynced) return;
  const { error } = await supabase.from('health_daily').upsert(rows, { onConflict: 'user_id,logged_date' });
  if (error) console.error('Error saving health data:', error);
  else lastSynced = key;
};

export const useHealthConnect = () => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Already granted from an earlier session: show data straight away.
  useEffect(() => {
    HealthConnect.checkPermissions().then(({ granted }) => {
      if (!granted) return;
      setIsConnected(true);
      fetchHealthData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestPermissions = async () => {
    setLoading(true);
    try {
      const result = await HealthConnect.requestPermissions();
      setIsConnected(result.granted);

      if (result.granted) {
        toast({
          title: 'Connected Successfully',
          description: 'Health Connect permissions granted',
        });
        await fetchHealthData();
      } else {
        toast({
          title: 'Permissions Required',
          description: 'Please grant permissions to access health data',
          variant: 'destructive',
        });
      }

      return result.granted;
    } catch (error) {
      console.error('Error requesting permissions:', error);
      toast({
        title: 'Connection Failed',
        description: 'Failed to connect to Health Connect',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      const [stepsHistory, caloriesHistory] = await Promise.all([
        HealthConnect.getStepsForDays(30),
        HealthConnect.getCaloriesForDays(30),
      ]);
      if (user) void syncDaily(user.id, stepsHistory, caloriesHistory);
      // Today is the last day of each history.
      const today = caloriesHistory.at(-1);

      setHealthData({
        steps: stepsHistory.at(-1)?.steps ?? 0,
        activeCalories: today?.activeCalories ?? 0,
        lastUpdated: new Date().toISOString(),
        history: {
          steps: stepsHistory,
          calories: caloriesHistory,
        }
      });
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast({
        title: 'Data Fetch Failed',
        description: 'Failed to fetch health data from Health Connect',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData,
  };
};
