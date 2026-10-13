import { useEffect, useSyncExternalStore } from 'react';
import HealthConnect from '@/plugins/healthConnect';
import { toast } from '@/hooks/use-toast';
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
// only on the phone). A save that matches the last successful one is skipped.
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
  // updated_at is set here because an upsert only applies the column default on insert; without it
  // the saved time stayed at the first save of each day.
  const savedAt = new Date().toISOString();
  const { error } = await supabase
    .from('health_daily')
    .upsert(
      rows.map((r) => ({ ...r, updated_at: savedAt })),
      { onConflict: 'user_id,logged_date' }
    );
  if (error) console.error('Error saving health data:', error);
  else lastSynced = key;
};

// One copy of the data and one fetch, shared by every component that uses the hook. Each used to keep
// its own, so on first open the Steps card and the calorie ring filled in at different times.
interface Shared {
  isConnected: boolean;
  healthData: HealthData | null;
  loading: boolean;
}
const initial: Shared = { isConnected: false, healthData: null, loading: false };
let shared = initial;
const listeners = new Set<() => void>();
const setShared = (patch: Partial<Shared>) => {
  shared = { ...shared, ...patch };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getShared = () => shared;

let owner: string | null = null; // the signed-in user the shared data belongs to
let started = false;
let inflight: Promise<void> | null = null;
let lastFetchStarted = 0;
let listeningForReturn = false;

// The app is usually left in the background rather than closed, so mounting alone never re-reads the
// watch. Read it again when the app comes back to the front, at most once every 30 seconds.
const RETURN_REFRESH_MS = 30_000;
const refreshOnReturn = () => {
  if (document.visibilityState !== 'visible' || !shared.isConnected || !owner) return;
  if (Date.now() - lastFetchStarted < RETURN_REFRESH_MS) return;
  void fetchHealthData();
};

// Joins a fetch already running rather than starting another.
const fetchHealthData = (): Promise<void> => {
  if (inflight) return inflight;
  lastFetchStarted = Date.now();
  setShared({ loading: true });
  inflight = (async () => {
    try {
      const [stepsHistory, caloriesHistory] = await Promise.all([
        HealthConnect.getStepsForDays(30),
        HealthConnect.getCaloriesForDays(30),
      ]);
      if (owner) void syncDaily(owner, stepsHistory, caloriesHistory);
      // Today is the last day of each history.
      const today = caloriesHistory.at(-1);

      setShared({
        healthData: {
          steps: stepsHistory.at(-1)?.steps ?? 0,
          activeCalories: today?.activeCalories ?? 0,
          lastUpdated: new Date().toISOString(),
          history: {
            steps: stepsHistory,
            calories: caloriesHistory,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching health data:', error);
      toast({
        title: 'Data Fetch Failed',
        description: 'Failed to fetch health data from Health Connect',
        variant: 'destructive',
      });
    } finally {
      setShared({ loading: false });
      inflight = null;
    }
  })();
  return inflight;
};

// Already granted from an earlier session: show data straight away.
const start = () => {
  if (started) return;
  started = true;
  if (!listeningForReturn) {
    listeningForReturn = true;
    document.addEventListener('visibilitychange', refreshOnReturn);
  }
  HealthConnect.checkPermissions().then(({ granted }) => {
    if (!granted) return;
    setShared({ isConnected: true });
    void fetchHealthData();
  });
};

const requestPermissions = async () => {
  setShared({ loading: true });
  try {
    const result = await HealthConnect.requestPermissions();
    setShared({ isConnected: result.granted });

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
    setShared({ loading: false });
  }
};

export const useHealthConnect = () => {
  const { user } = useAuth();
  const { isConnected, healthData, loading } = useSyncExternalStore(subscribe, getShared);

  useEffect(() => {
    const id = user?.id ?? null;
    if (id !== owner) {
      // A different user signed in: drop the previous user's data.
      owner = id;
      started = false;
      setShared(initial);
    }
    if (id) start();
  }, [user?.id]);

  return {
    isConnected,
    healthData,
    loading,
    requestPermissions,
    fetchHealthData,
  };
};
