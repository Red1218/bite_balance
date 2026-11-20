import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Draft, Exercise, Routine, RoutineItem, Workout, WorkoutSet } from '@/lib/workouts';

// shortcut: only the newest workouts are loaded (for history, "previous" and next-up); once
// exercise charts need older sets (Phase 3), query them per exercise instead.
const RECENT = 60;

const DRAFT_KEY = 'bb:workout-draft';
const readDraft = (): Draft | null => {
  try {
    const v = localStorage.getItem(DRAFT_KEY);
    return v ? (JSON.parse(v) as Draft) : null;
  } catch {
    return null;
  }
};
const listeners = new Set<(d: Draft | null) => void>();

/** The workout in progress, kept on the phone so closing the app mid-session loses nothing. */
export const useWorkoutDraft = () => {
  const [draft, setLocal] = useState<Draft | null>(readDraft);
  useEffect(() => {
    listeners.add(setLocal);
    return () => void listeners.delete(setLocal);
  }, []);
  const setDraft = useCallback((next: Draft | null | ((prev: Draft | null) => Draft | null)) => {
    const value = typeof next === 'function' ? next(readDraft()) : next;
    try {
      if (value) localStorage.setItem(DRAFT_KEY, JSON.stringify(value));
      else localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* storage full: the draft still lives in memory */
    }
    listeners.forEach((l) => l(value));
  }, []);
  return [draft, setDraft] as const;
};

const toSet = (r: WorkoutSet): WorkoutSet => ({
  ...r,
  weight_kg: r.weight_kg == null ? null : Number(r.weight_kg),
  distance_km: r.distance_km == null ? null : Number(r.distance_km),
});

/** Workouts started since `since` (ms) and their sets, for the stats page. */
export const useWorkoutHistory = (since: number) => {
  const { user } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    const from = new Date(since).toISOString();
    setLoading(true);
    // A set is saved after its workout starts, so created_at >= since covers every set of these workouts.
    Promise.all([
      supabase.from('workouts').select('id, name, started_at, ended_at, note, routine_id').eq('user_id', user.id).gte('started_at', from),
      supabase
        .from('workout_sets')
        .select('workout_id, exercise_id, position, set_no, set_type, weight_kg, reps, duration_s, distance_km')
        .eq('user_id', user.id)
        .gte('created_at', from),
    ]).then(([wRes, sRes]) => {
      if (!live) return;
      if (wRes.error || sRes.error) {
        console.error('Error loading workout history:', wRes.error ?? sRes.error);
        setError(true);
      } else {
        setError(false);
        setWorkouts(wRes.data as Workout[]);
        setSets((sRes.data as WorkoutSet[]).map(toSet));
      }
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [user, since]);

  return { workouts, sets, loading, error };
};

export const useWorkouts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    // RLS returns the built-in library plus this user's own exercises.
    const [exRes, wRes, rRes] = await Promise.all([
      supabase.from('exercises').select('id, user_id, name, body_part, secondary, equipment, kind').order('name'),
      supabase.from('workouts').select('id, name, started_at, ended_at, note, routine_id').eq('user_id', user.id).order('started_at', { ascending: false }).limit(RECENT),
      supabase.from('routines').select('id, name, position, items').eq('user_id', user.id).order('position'),
    ]);
    if (exRes.error || wRes.error || rRes.error) {
      console.error('Error loading workouts:', exRes.error ?? wRes.error ?? rRes.error);
      setError('Could not load your workouts.');
      setLoading(false);
      return;
    }
    const list = wRes.data as Workout[];
    let setRows: WorkoutSet[] = [];
    if (list.length) {
      const sRes = await supabase
        .from('workout_sets')
        .select('workout_id, exercise_id, position, set_no, set_type, weight_kg, reps, duration_s, distance_km')
        .in('workout_id', list.map((w) => w.id));
      if (sRes.error) {
        console.error('Error loading workout sets:', sRes.error);
        setError('Could not load your workouts.');
        setLoading(false);
        return;
      }
      setRows = (sRes.data as WorkoutSet[]).map(toSet);
    }
    // The table's check constraints guarantee the string unions.
    setExercises((exRes.data as Exercise[]).sort((a, b) => a.name.localeCompare(b.name)));
    setWorkouts(list);
    setSets(setRows);
    // items is written only by this app, in the RoutineItem shape.
    setRoutines((rRes.data as unknown as Routine[]).sort((a, b) => a.position - b.position));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const failed = (description: string) => toast({ title: 'Error', description, variant: 'destructive' });

  const createExercise = async (values: Omit<Exercise, 'id' | 'user_id'>) => {
    if (!user) return null;
    const { data, error: writeError } = await supabase
      .from('exercises')
      .insert({ ...values, name: values.name.trim(), user_id: user.id })
      .select('id, user_id, name, body_part, secondary, equipment, kind')
      .single();
    if (writeError || !data) {
      console.error('Error creating exercise:', writeError);
      failed('Could not save the exercise. Please try again.');
      return null;
    }
    const saved = data as Exercise;
    setExercises((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
    return saved;
  };

  // The workout row first, then its sets; if the sets fail, the workout is removed again so a
  // half-saved session never shows, and the draft stays for another try.
  const saveWorkout = async (workout: Workout, rows: WorkoutSet[]) => {
    if (!user) return false;
    const { error: wError } = await supabase.from('workouts').insert({ ...workout, user_id: user.id });
    if (wError) {
      console.error('Error saving workout:', wError);
      failed('Could not save the workout. Please try again.');
      return false;
    }
    const { error: sError } = await supabase.from('workout_sets').insert(rows.map((r) => ({ ...r, user_id: user.id })));
    if (sError) {
      console.error('Error saving workout sets:', sError);
      await supabase.from('workouts').delete().eq('id', workout.id);
      failed('Could not save the workout. Please try again.');
      return false;
    }
    setWorkouts((prev) => [workout, ...prev].sort((a, b) => b.started_at.localeCompare(a.started_at)));
    setSets((prev) => [...prev, ...rows]);
    return true;
  };

  // Every earlier set of these exercises, to tell what counts as a new record.
  const exerciseHistory = useCallback(
    async (exerciseIds: string[]) => {
      if (!user || !exerciseIds.length) return [];
      const { data, error: readError } = await supabase
        .from('workout_sets')
        .select('workout_id, exercise_id, position, set_no, set_type, weight_kg, reps, duration_s, distance_km')
        .eq('user_id', user.id)
        .in('exercise_id', exerciseIds);
      if (readError) {
        console.error('Error loading exercise history:', readError);
        return [];
      }
      return (data as WorkoutSet[]).map(toSet);
    },
    [user]
  );

  const saveRoutine = async (values: { name: string; items: RoutineItem[] }, id?: string) => {
    if (!user) return null;
    const position = routines.reduce((max, r) => Math.max(max, r.position), -1) + 1;
    const row = { name: values.name.trim(), items: values.items as unknown as Json };
    const { data, error: writeError } = id
      ? await supabase.from('routines').update(row).eq('id', id).select('id, name, position, items').single()
      : await supabase.from('routines').insert({ ...row, user_id: user.id, position }).select('id, name, position, items').single();
    if (writeError || !data) {
      console.error('Error saving routine:', writeError);
      failed('Could not save the routine. Please try again.');
      return null;
    }
    const saved = data as unknown as Routine;
    setRoutines((prev) => (id ? prev.map((r) => (r.id === id ? saved : r)) : [...prev, saved]));
    return saved;
  };

  // Workouts started from it keep their history; their routine_id becomes null.
  const deleteRoutine = async (id: string) => {
    const { error: writeError } = await supabase.from('routines').delete().eq('id', id);
    if (writeError) {
      console.error('Error deleting routine:', writeError);
      failed('Could not delete the routine. Please try again.');
      return false;
    }
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    return true;
  };

  // Its sets go with it (on delete cascade).
  const deleteWorkout = async (id: string) => {
    const { error: writeError } = await supabase.from('workouts').delete().eq('id', id);
    if (writeError) {
      console.error('Error deleting workout:', writeError);
      failed('Could not delete the workout. Please try again.');
      return false;
    }
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
    setSets((prev) => prev.filter((s) => s.workout_id !== id));
    return true;
  };

  return { exercises, byId, workouts, sets, routines, loading, error, createExercise, saveWorkout, deleteWorkout, exerciseHistory, saveRoutine, deleteRoutine };
};
