import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Calculator, Save, Moon, Sun, Monitor, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const WATER_GOAL_GLASSES = 8; // matches useWaterTracker's fixed daily goal
const STEP_GOAL = 10000; // matches Steps.tsx

const Profile = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { preference: themePreference, setTheme } = useTheme();
  const { isConnected: healthConnected, requestPermissions } = useHealthConnect();

  const [isEditing, setIsEditing] = useState(false);

  const [profile, setProfile] = useState({
    name: '',
    age: '',
    weight: '',
    height: '',
    activityLevel: 'active',
    gender: 'male',
    goal: 'maintain',
  });

  const [targetWeight, setTargetWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [savedTarget, setSavedTarget] = useState<{ targetWeight: number; targetDate: string; startWeight: number } | null>(null);

  const [calculatedGoal, setCalculatedGoal] = useState<number | null>(null);
  const [macroGoals, setMacroGoals] = useState({ protein: '', carbs: '', fat: '', fiber: '' });
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');
  const [portionUnits, setPortionUnits] = useState('katori, roti');

  const [waterReminders, setWaterReminders] = useState(false);
  const [mealLogNudges, setMealLogNudges] = useState(false);
  const [showFibreAndSugar, setShowFibreAndSugar] = useState(true);

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();

      if (data) {
        const meta = user.user_metadata || {};
        setProfile({
          name: data.name || '',
          age: data.age?.toString() || '',
          weight: data.weight?.toString() || '',
          height: data.height?.toString() || '',
          activityLevel: meta.activity_level || 'active',
          gender: meta.gender || 'male',
          goal: meta.weight_goal || 'maintain',
        });
        if (meta.calorie_goal) setCalculatedGoal(Number(meta.calorie_goal));
        if (meta.target_weight && meta.target_date && meta.goal_start_weight) {
          setTargetWeight(String(meta.target_weight));
          setTargetDate(meta.target_date);
          setSavedTarget({
            targetWeight: Number(meta.target_weight),
            targetDate: meta.target_date,
            startWeight: Number(meta.goal_start_weight),
          });
        }
        setMacroGoals({
          protein: meta.protein_goal ? String(meta.protein_goal) : '',
          carbs: meta.carbs_goal ? String(meta.carbs_goal) : '',
          fat: meta.fat_goal ? String(meta.fat_goal) : '',
          fiber: meta.fiber_goal ? String(meta.fiber_goal) : '',
        });
        setWeightUnit(meta.weight_unit === 'lb' ? 'lb' : 'kg');
        setPortionUnits(meta.portion_units ?? 'katori, roti');
        setWaterReminders(Boolean(meta.water_reminders_enabled));
        setMealLogNudges(Boolean(meta.meal_log_nudges_enabled));
        setShowFibreAndSugar(meta.show_fibre_and_sugar ?? true);
      }
    };

    loadProfile();
  }, [user]);

  // Instant-apply preference toggles/selects — each writes immediately, independent of the edit-panel Save
  const updateMeta = async (data: Record<string, unknown>) => {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) {
      toast({ title: 'Error', description: 'Failed to save preference.', variant: 'destructive' });
    }
  };

  const handleWaterRemindersChange = (checked: boolean) => {
    setWaterReminders(checked);
    updateMeta({ water_reminders_enabled: checked });
  };

  const handleMealLogNudgesChange = (checked: boolean) => {
    setMealLogNudges(checked);
    updateMeta({ meal_log_nudges_enabled: checked });
  };

  const handleShowFibreAndSugarChange = (checked: boolean) => {
    setShowFibreAndSugar(checked);
    updateMeta({ show_fibre_and_sugar: checked });
  };

  const handleGoogleFitChange = async (checked: boolean) => {
    if (checked) {
      await requestPermissions();
    } else {
      toast({
        title: 'Manage in Android Settings',
        description: 'Health Connect access can only be revoked from Android Settings > Health Connect.',
      });
    }
  };

  const handleWeightUnitChange = (unit: 'kg' | 'lb') => {
    setWeightUnit(unit);
    updateMeta({ weight_unit: unit });
  };

  const handlePortionUnitsBlur = () => {
    updateMeta({ portion_units: portionUnits });
  };

  const displayWeight = (kg: number) => (weightUnit === 'lb' ? kg * 2.20462 : kg);
  const weightSuffix = weightUnit;

  const calculateCalorieGoal = () => {
    const weight = parseFloat(profile.weight);
    const height = parseFloat(profile.height);
    const age = parseInt(profile.age);

    if (!weight || !height || !age) {
      toast({ title: 'Invalid Input', description: 'Please fill in all fields with valid numbers.', variant: 'destructive' });
      return;
    }

    let bmr;
    if (profile.gender === 'male') {
      bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    const activityMultipliers = { sedentary: 1.2, active: 1.55, very_active: 1.725 };
    const tdee = bmr * activityMultipliers[profile.activityLevel as keyof typeof activityMultipliers];

    let goalCalories = tdee;
    if (profile.goal === 'lose') goalCalories = tdee - 500;
    else if (profile.goal === 'gain') goalCalories = tdee + 500;

    setCalculatedGoal(Math.round(goalCalories));
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profile.name,
          age: parseInt(profile.age) || null,
          weight: parseFloat(profile.weight) || null,
          height: parseFloat(profile.height) || null,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      const calorieGoal = calculatedGoal || user.user_metadata?.calorie_goal || 2200;

      const targetChanged = targetWeight && (!savedTarget || savedTarget.targetWeight !== parseFloat(targetWeight));
      const goalStartWeight = targetChanged
        ? parseFloat(profile.weight) || 0
        : (savedTarget?.startWeight ?? (parseFloat(profile.weight) || 0));

      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          gender: profile.gender,
          activity_level: profile.activityLevel,
          weight_goal: profile.goal,
          calorie_goal: calorieGoal,
          target_weight: targetWeight ? parseFloat(targetWeight) : null,
          target_date: targetDate || null,
          goal_start_weight: targetWeight ? goalStartWeight : null,
          protein_goal: macroGoals.protein ? Number(macroGoals.protein) : null,
          carbs_goal: macroGoals.carbs ? Number(macroGoals.carbs) : null,
          fat_goal: macroGoals.fat ? Number(macroGoals.fat) : null,
          fiber_goal: macroGoals.fiber ? Number(macroGoals.fiber) : null,
        },
      });

      if (metaError) throw metaError;

      setSavedTarget(targetWeight && targetDate ? { targetWeight: parseFloat(targetWeight), targetDate, startWeight: goalStartWeight } : null);

      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({ title: 'Error', description: 'Failed to save profile. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const initials = (profile.name || user?.email || 'U')
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;

  const bmi =
    profile.weight && profile.height
      ? parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)
      : null;

  const calorieGoal = Number(user?.user_metadata?.calorie_goal || calculatedGoal || 2200);
  const proteinGoal = Math.round(Number(user?.user_metadata?.protein_goal) || (calorieGoal * 0.3) / 4);
  const carbsGoal = Math.round(Number(user?.user_metadata?.carbs_goal) || (calorieGoal * 0.45) / 4);
  const fatGoal = Math.round(Number(user?.user_metadata?.fat_goal) || (calorieGoal * 0.25) / 9);
  const fiberGoal = Math.round(Number(user?.user_metadata?.fiber_goal) || 25);
  const waterGoalLiters = (WATER_GOAL_GLASSES * 0.25).toFixed(1);

  const inputClass = 'h-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">You</h1>
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          className="rounded-full border border-border bg-card px-3.5 py-1.5 font-sans text-xs font-medium text-primary"
        >
          {isEditing ? 'Done' : 'Edit profile'}
        </button>
      </div>

      {/* Identity */}
      <div className="elevation-card flex items-center gap-3.5 p-4">
        <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-full border border-primary/32 bg-primary/16 font-display text-xl font-semibold text-primary">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
            {profile.name || 'Your name'}
          </div>
          <div className="mt-1.5 truncate text-xs text-muted-foreground">{user?.email}</div>
          {memberSince && (
            <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">Member since {memberSince}</div>
          )}
        </div>
      </div>

      {/* Health summary */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="elevation-card p-3.5">
          <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Weight
          </div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">
            {profile.weight ? displayWeight(parseFloat(profile.weight)).toFixed(1) : '--'}
            <span className="font-sans text-[10px] font-medium text-muted-foreground"> {weightSuffix}</span>
          </div>
        </div>
        <div className="elevation-card p-3.5">
          <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Height
          </div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-foreground">
            {profile.height ? parseFloat(profile.height).toFixed(0) : '--'}
            <span className="font-sans text-[10px] font-medium text-muted-foreground"> cm</span>
          </div>
        </div>
        <div className="elevation-card p-3.5">
          <div className="font-sans text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            BMI
          </div>
          <div className="mt-2 font-mono text-xl font-semibold tabular-nums text-primary">
            {bmi ? bmi.toFixed(1) : '--'}
          </div>
        </div>
      </div>

      {/* Daily goals — read-only summary */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Daily goals
          </div>
          <button type="button" onClick={() => setIsEditing(true)} className="font-sans text-xs font-medium text-primary">
            Adjust
          </button>
        </div>
        <div className="elevation-card space-y-4 p-4">
          <div className="font-mono text-3xl font-bold tabular-nums text-foreground">
            {calorieGoal.toLocaleString()}
            <span className="font-sans text-sm font-medium text-muted-foreground"> kcal</span>
          </div>
          <div className="space-y-2.5 border-t border-border pt-3.5">
            {[
              { label: 'Protein', value: `${proteinGoal} g`, dot: 'bg-chart-protein' },
              { label: 'Carbs', value: `${carbsGoal} g`, dot: 'bg-chart-carbs' },
              { label: 'Fat', value: `${fatGoal} g`, dot: 'bg-chart-fat' },
              { label: 'Fibre', value: `${fiberGoal} g`, dot: 'bg-chart-fiber' },
              { label: 'Water', value: `${waterGoalLiters} L`, dot: 'bg-chart-water' },
              { label: 'Steps', value: STEP_GOAL.toLocaleString(), dot: 'bg-chart-steps' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('h-[7px] w-[7px] rounded-sm', row.dot)} />
                  <span className="font-sans text-sm text-foreground">{row.label}</span>
                </div>
                <span className="font-mono text-sm font-medium tabular-nums text-muted-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isEditing && (
        <>
          {/* Personal information */}
          <div className="space-y-2">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Personal information
            </div>
            <div className="elevation-card space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm text-foreground">Name</Label>
                  <Input id="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="Your name" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age" className="text-sm text-foreground">Age</Label>
                  <Input id="age" type="number" value={profile.age} onChange={(e) => setProfile({ ...profile, age: e.target.value })} placeholder="Years" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="weight" className="text-sm text-foreground">Weight (kg)</Label>
                  <Input id="weight" type="number" value={profile.weight} onChange={(e) => setProfile({ ...profile, weight: e.target.value })} placeholder="Kilograms" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height" className="text-sm text-foreground">Height (cm)</Label>
                  <Input id="height" type="number" value={profile.height} onChange={(e) => setProfile({ ...profile, height: e.target.value })} placeholder="Centimeters" className={inputClass} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-sm text-foreground">Gender</Label>
                  <Select value={profile.gender} onValueChange={(value) => setProfile({ ...profile, gender: value })}>
                    <SelectTrigger className="h-12 rounded-xl border-border bg-background text-foreground [&>svg]:text-muted-foreground">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="male" className="text-foreground hover:bg-accent focus:bg-accent">Male</SelectItem>
                      <SelectItem value="female" className="text-foreground hover:bg-accent focus:bg-accent">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="activityLevel" className="text-sm text-foreground">Activity level</Label>
                  <Select value={profile.activityLevel} onValueChange={(value) => setProfile({ ...profile, activityLevel: value })}>
                    <SelectTrigger className="h-12 rounded-xl border-border bg-background text-foreground [&>svg]:text-muted-foreground">
                      <SelectValue placeholder="Select activity level" />
                    </SelectTrigger>
                    <SelectContent className="border-border bg-card">
                      <SelectItem value="sedentary" className="text-foreground hover:bg-accent focus:bg-accent">Sedentary</SelectItem>
                      <SelectItem value="active" className="text-foreground hover:bg-accent focus:bg-accent">Active</SelectItem>
                      <SelectItem value="very_active" className="text-foreground hover:bg-accent focus:bg-accent">Very Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="goal" className="text-sm text-foreground">Goal</Label>
                <Select value={profile.goal} onValueChange={(value) => setProfile({ ...profile, goal: value })}>
                  <SelectTrigger className="h-12 rounded-xl border-border bg-background text-foreground [&>svg]:text-muted-foreground">
                    <SelectValue placeholder="Select your goal" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-card">
                    <SelectItem value="lose" className="text-foreground hover:bg-accent focus:bg-accent">Lose Weight</SelectItem>
                    <SelectItem value="maintain" className="text-foreground hover:bg-accent focus:bg-accent">Maintain Weight</SelectItem>
                    <SelectItem value="gain" className="text-foreground hover:bg-accent focus:bg-accent">Gain Weight</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Calorie goal calculator */}
          <div className="space-y-2">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Calorie goal
            </div>
            <div className="elevation-card p-4">
              <p className="mb-4 text-sm text-muted-foreground">
                Calculate your daily calorie goal based on your personal information and activity level.
              </p>
              <Button onClick={calculateCalorieGoal} className="mb-4 h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Calorie Goal
              </Button>
              {calculatedGoal && (
                <div className="rounded-xl border border-primary/30 bg-primary/14 p-4">
                  <h4 className="mb-2 font-sans text-sm font-semibold text-primary">Recommended daily calorie goal</h4>
                  <div className="mb-2 font-mono text-3xl font-bold tabular-nums text-primary">
                    {calculatedGoal.toLocaleString()}
                    <span className="font-sans text-sm font-medium"> kcal</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Based on your current profile settings and {profile.goal} goal.</p>
                </div>
              )}
            </div>
          </div>

          {/* Macro goal overrides */}
          <div className="space-y-2">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Macro goals
            </div>
            <div className="elevation-card p-4">
              <p className="mb-4 text-xs text-muted-foreground">
                Override the auto-calculated macro splits. Leave blank to use values derived from your calorie goal.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="proteinGoal" className="flex items-center gap-1.5 text-sm text-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-chart-protein" />
                    Protein (g/day)
                  </Label>
                  <Input id="proteinGoal" type="number" min="0" value={macroGoals.protein} onChange={(e) => setMacroGoals({ ...macroGoals, protein: e.target.value })} placeholder={String(proteinGoal)} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carbsGoal" className="flex items-center gap-1.5 text-sm text-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-chart-carbs" />
                    Carbs (g/day)
                  </Label>
                  <Input id="carbsGoal" type="number" min="0" value={macroGoals.carbs} onChange={(e) => setMacroGoals({ ...macroGoals, carbs: e.target.value })} placeholder={String(carbsGoal)} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fatGoal" className="flex items-center gap-1.5 text-sm text-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-chart-fat" />
                    Fat (g/day)
                  </Label>
                  <Input id="fatGoal" type="number" min="0" value={macroGoals.fat} onChange={(e) => setMacroGoals({ ...macroGoals, fat: e.target.value })} placeholder={String(fatGoal)} className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fiberGoal" className="flex items-center gap-1.5 text-sm text-foreground">
                    <span className="inline-block h-2 w-2 rounded-full bg-chart-fiber" />
                    Fibre (g/day)
                  </Label>
                  <Input id="fiberGoal" type="number" min="0" value={macroGoals.fiber} onChange={(e) => setMacroGoals({ ...macroGoals, fiber: e.target.value })} placeholder={String(fiberGoal)} className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          {/* Target */}
          <div className="space-y-2">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Target
            </div>
            <div className="elevation-card space-y-4 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="targetWeight" className="text-sm text-foreground">Target weight (kg)</Label>
                  <Input id="targetWeight" type="number" step="0.1" value={targetWeight} onChange={(e) => setTargetWeight(e.target.value)} placeholder="Kilograms" className={inputClass} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="targetDate" className="text-sm text-foreground">Target date</Label>
                  <Input id="targetDate" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className={inputClass} />
                </div>
              </div>
            </div>
          </div>

          <Button onClick={handleSave} className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : 'Save changes'}
          </Button>
        </>
      )}

      {/* Target progress — always visible once a target is set */}
      {!isEditing && savedTarget && profile.weight && (() => {
        const current = parseFloat(profile.weight);
        const { targetWeight: goalWeight, startWeight, targetDate: goalDate } = savedTarget;
        const span = startWeight - goalWeight;
        const progressed = startWeight - current;
        const pct = span !== 0 ? Math.max(0, Math.min(100, Math.round((progressed / span) * 100))) : 0;
        const verb = goalWeight < startWeight ? 'Lose' : 'Gain';
        const delta = Math.abs(startWeight - goalWeight).toFixed(1);
        return (
          <div className="space-y-2">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Target
            </div>
            <div className="elevation-card space-y-3 p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-sans text-sm font-medium text-foreground">
                  {verb} {delta} kg by {new Date(goalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
                <div className="font-mono text-sm font-semibold tabular-nums text-chart-fiber">{pct}%</div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-chart-fiber transition-all duration-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
                <span>Start {startWeight.toFixed(1)}</span>
                <span>Now {current.toFixed(1)}</span>
                <span>Goal {goalWeight.toFixed(1)}</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Appearance */}
      <div className="space-y-2">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Appearance
        </div>
        <div className="elevation-card space-y-3.5 p-[15px]">
          <div className="text-sm font-medium text-foreground">Theme</div>
          <div className="flex gap-2 rounded-xl border border-border bg-muted p-1">
            {([
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'light', label: 'Light', icon: Sun },
              { value: 'system', label: 'System', icon: Monitor },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  'flex h-[38px] flex-1 items-center justify-center gap-1.5 rounded-[9px] text-xs font-semibold transition-colors',
                  themePreference === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tracking */}
      <div className="space-y-2">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Tracking
        </div>
        <div className="elevation-card divide-y divide-border overflow-hidden p-0">
          <div className="flex items-center justify-between px-[15px] py-[13px]">
            <span className="text-sm font-medium text-foreground">Water reminders</span>
            <Switch checked={waterReminders} onCheckedChange={handleWaterRemindersChange} />
          </div>
          <div className="flex items-center justify-between px-[15px] py-[13px]">
            <span className="text-sm font-medium text-foreground">Meal log nudges</span>
            <Switch checked={mealLogNudges} onCheckedChange={handleMealLogNudgesChange} />
          </div>
          <div className="flex items-center justify-between px-[15px] py-[13px]">
            <span className="text-sm font-medium text-foreground">Google Fit sync</span>
            <Switch checked={healthConnected} onCheckedChange={handleGoogleFitChange} />
          </div>
          {/* ponytail: preference is stored/persisted but doesn't gate any view yet — sugar isn't tracked anywhere in the schema, and the dashboard macro row shows fibre unconditionally per the current design spec */}
          <div className="flex items-center justify-between px-[15px] py-[13px]">
            <span className="text-sm font-medium text-foreground">Show fibre and sugar</span>
            <Switch checked={showFibreAndSugar} onCheckedChange={handleShowFibreAndSugarChange} />
          </div>
        </div>
      </div>

      {/* Units & account */}
      <div className="space-y-2">
        <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Units &amp; account
        </div>
        <div className="elevation-card divide-y divide-border overflow-hidden p-0">
          <div className="flex items-center justify-between px-[15px] py-[13px]">
            <span className="text-sm font-medium text-foreground">Weight unit</span>
            <div className="flex gap-1 rounded-full border border-border bg-muted p-0.5">
              {(['kg', 'lb'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  onClick={() => handleWeightUnitChange(unit)}
                  className={cn(
                    'rounded-full px-2.5 py-1 font-mono text-xs',
                    weightUnit === unit ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  {unit}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 px-[15px] py-[13px]">
            <span className="flex-1 text-sm font-medium text-foreground">Portion units</span>
            <input
              value={portionUnits}
              onChange={(e) => setPortionUnits(e.target.value)}
              onBlur={handlePortionUnitsBlur}
              className="w-32 rounded-lg border border-transparent bg-transparent text-right font-mono text-sm text-muted-foreground focus:border-border focus:bg-background focus:outline-none"
            />
          </div>
          <button type="button" onClick={() => signOut()} className="flex w-full items-center justify-between px-[15px] py-[13px] text-left">
            <span className="text-sm font-medium text-primary">Sign out</span>
            <ChevronRight className="h-4 w-4 text-primary/60" />
          </button>
        </div>
        <p className="pt-1 text-center font-mono text-[11px] text-faint">Bite Balance 2.0.1 · build 214</p>
      </div>
    </div>
  );
};

export default Profile;
