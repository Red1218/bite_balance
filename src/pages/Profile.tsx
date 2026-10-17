import { useState, useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer';
import { useToast } from '@/hooks/use-toast';
import {
  Activity, ChevronDown, ChevronRight, ChevronUp, Download, Droplet, Flame, Footprints, LogOut, Minus, Moon, Plus, Scale, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useHealthConnect } from '@/hooks/useHealthConnect';
import { useStreak } from '@/hooks/useStreak';
import { useWeightLogs, type WeightLog } from '@/hooks/useWeightLogs';
import { useLogStats } from '@/hooks/useLogStats';
import { useCountUp } from '@/hooks/useCountUp';
import { supabase } from '@/integrations/supabase/client';
import { cn, fmtLocalDate } from '@/lib/utils';
import { MICRO } from '@/components/MealReviewList';
import MacroRing from '@/components/MacroRing';
import MenuButton from '@/components/MenuButton';
import Segmented from '@/components/Segmented';
import { exportBackup } from '@/lib/exportData';

const WATER_GOAL_GLASSES = 8; // matches useWaterTracker's fixed daily goal
const STEP_GOAL = 10000; // matches Steps.tsx

// Standard adult RDA defaults -- same values the chat-meal edge function's
// reference data assumes. `cap` marks an upper limit rather than a target minimum.
const LONG_NAME: Record<string, string> = { vitaminC: 'Vitamin C', vitaminD: 'Vitamin D', vitaminB12: 'Vitamin B12' };
const MICRO_GOALS = MICRO.map((m) => ({
  label: LONG_NAME[m.key] ?? m.label,
  value: `${'cap' in m ? '≤ ' : ''}${m.goal.toLocaleString('en-US')} ${m.unit}`,
  dot: m.dot,
}));

const ACTIVITY_MULTIPLIERS ={ sedentary: 1.2, active: 1.55, very_active: 1.725 };

const computeCalorieGoal = (profile: { weight: string; height: string; age: string; gender: string; activityLevel: string; goal: string }, fallback: number) => {
  const weight = parseFloat(profile.weight);
  const height = parseFloat(profile.height);
  const age = parseInt(profile.age);
  if (!weight || !height || !age) return fallback;

  const bmr =
    profile.gender === 'male'
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;
  const tdee = bmr * (ACTIVITY_MULTIPLIERS[profile.activityLevel as keyof typeof ACTIVITY_MULTIPLIERS] || ACTIVITY_MULTIPLIERS.active);

  let goalCalories = tdee;
  if (profile.goal === 'lose') goalCalories -= 500;
  else if (profile.goal === 'gain') goalCalories += 500;

  return Math.round(goalCalories);
};

interface Option { value: string; label: string; long?: string; hint?: string }
const GENDER_OPTIONS: Option[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];
const ACTIVITY_OPTIONS: Option[] = [
  { value: 'sedentary', label: 'Sedentary', hint: 'little or no exercise' },
  { value: 'active', label: 'Active', hint: '3–5 workouts / wk' },
  { value: 'very_active', label: 'Very active', hint: '6–7 workouts / wk' },
];
const GOAL_OPTIONS: Option[] = [
  { value: 'lose', label: 'Lose', long: 'Lose weight', hint: '500 kcal under what you burn, about 0.45 kg a week' },
  { value: 'maintain', label: 'Maintain', long: 'Maintain weight', hint: 'Matches what you burn each day' },
  { value: 'gain', label: 'Gain', long: 'Gain weight', hint: '500 kcal over what you burn, about 0.45 kg a week' },
];
const optionOf = (options: Option[], value: string) => options.find((o) => o.value === value);

// Macro splits as % of calories. Balanced is the automatic split, so choosing it clears the overrides.
const SPLITS = {
  balanced: { label: 'Balanced', p: 30, c: 45, f: 25 },
  high_protein: { label: 'High protein', p: 35, c: 40, f: 25 },
  low_carb: { label: 'Low carb', p: 35, c: 25, f: 40 },
} as const;
type SplitKey = keyof typeof SPLITS | 'custom';
const gramsFor = (kcal: number, s: { p: number; c: number; f: number }) => ({
  protein: Math.round((kcal * s.p) / 400),
  carbs: Math.round((kcal * s.c) / 400),
  fat: Math.round((kcal * s.f) / 900),
});
const MACRO_LABEL = { protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fibre' } as const;
type MacroStrings = { protein: string; carbs: string; fat: string; fiber: string };
// The preset whose grams the saved overrides match, so reopening the sheet shows the same choice.
const splitOf = (m: MacroStrings, kcal: number): SplitKey => {
  if (!m.protein && !m.carbs && !m.fat) return 'balanced';
  const match = (Object.keys(SPLITS) as (keyof typeof SPLITS)[]).find((k) => {
    const g = gramsFor(kcal, SPLITS[k]);
    return Number(m.protein) === g.protein && Number(m.carbs) === g.carbs && Number(m.fat) === g.fat;
  });
  return match ?? 'custom';
};

// What the Body/Plan sheets edit. Weight is held in the display unit (kg or lb)
// so the stepper and ruler move in clean 0.1 steps of whatever the user reads.
interface Draft { weight: number; height: number; age: number; gender: string; activityLevel: string; goal: string }
interface PlanDraft { split: SplitKey; macros: MacroStrings; targetWeight: string; targetDate: string }
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const rise = (i: number): CSSProperties => ({ animationDelay: `${Math.min(i, 6) * 60}ms` });

const SectionLabel = ({ children, onEdit, editLabel = 'Edit' }: { children: ReactNode; onEdit?: () => void; editLabel?: string }) => (
  <div className="flex h-5 items-center justify-between">
    <div className="font-display text-[15px] font-semibold text-foreground">{children}</div>
    {onEdit && (
      <button type="button" onClick={onEdit} className="-my-2 px-1 py-2 text-[13px] font-semibold text-primary">
        {editLabel}
      </button>
    )}
  </div>
);

const StepButton = ({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className="flex h-10 w-10 items-center justify-center rounded-[11px] border border-border bg-muted text-foreground active:bg-accent"
  >
    {children}
  </button>
);

// One sheet row: label (plus the old value once it changes) and a -/value/+ stepper.
const StepperRow = ({ label, value, unit, was, onStep, children }: {
  label: string; value: string; unit: string; was?: string; onStep: (dir: 1 | -1) => void; children?: ReactNode;
}) => (
  <div className="px-[14px] py-2.5">
    <div className="flex items-center justify-between">
      <div className="flex flex-col gap-1">
        <span className="text-sm text-foreground">{label}</span>
        {was && <span className="font-mono text-[10px] text-chart-carbs">{was}</span>}
      </div>
      <div className="flex items-center gap-1">
        <StepButton onClick={() => onStep(-1)} label={`Decrease ${label}`}><Minus className="h-3.5 w-3.5" /></StepButton>
        <div className="flex w-[90px] items-baseline justify-center gap-1">
          <span className="font-mono text-lg font-medium tabular-nums text-foreground">{value}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{unit}</span>
        </div>
        <StepButton onClick={() => onStep(1)} label={`Increase ${label}`}><Plus className="h-3.5 w-3.5" /></StepButton>
      </div>
    </div>
    {children}
  </div>
);

// Drag-to-scrub ruler: 10px per 0.1, labelled every whole number. data-vaul-no-drag
// keeps the horizontal drag from being read as a swipe to close the sheet.
const RULER_MASK = 'linear-gradient(90deg,transparent,#000 22%,#000 78%,transparent)';
const WeightRuler = ({ value, onChange }: { value: number; onChange: (v: number) => void }) => {
  const drag = useRef<{ x: number; v: number } | null>(null);
  const center = Math.round(value * 10);
  return (
    <div
      data-vaul-no-drag
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, v: value };
      }}
      onPointerMove={(e) => drag.current && onChange(drag.current.v - (e.clientX - drag.current.x) / 100)}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      className="relative mt-2 h-[60px] cursor-ew-resize touch-none select-none overflow-hidden"
      style={{ maskImage: RULER_MASK, WebkitMaskImage: RULER_MASK }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center">
        {Array.from({ length: 41 }, (_, i) => {
          const tick = center - 20 + i;
          const major = tick % 10 === 0;
          return (
            <div key={tick} className="relative flex h-[60px] w-[10px] flex-none justify-center">
              <div
                className={cn(
                  'mt-1.5 w-px',
                  major ? 'h-[26px] bg-foreground/80' : tick % 5 === 0 ? 'h-4 bg-muted-foreground/60' : 'h-[9px] bg-muted-foreground/35'
                )}
              />
              {major && (
                <span className="absolute left-1/2 top-10 -translate-x-1/2 font-mono text-[10px] text-muted-foreground">{tick / 10}</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute left-1/2 top-0 -ml-px h-9 w-0.5 rounded-sm bg-primary" />
    </div>
  );
};

const SegmentedField = ({ label, options, value, base, onChange }: {
  label: string; options: Option[]; value: string; base: string; onChange: (v: string) => void;
}) => (
  <div className="space-y-2">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      {value !== base ? (
        <span className="font-mono text-[10px] text-chart-carbs">was {optionOf(options, base)?.label ?? base}</span>
      ) : (
        <span className="truncate font-mono text-[10px] text-muted-foreground">{optionOf(options, value)?.hint}</span>
      )}
    </div>
    <Segmented label={label} options={options.map((o) => [o.value, o.label] as const)} value={value} onChange={onChange} />
  </div>
);

// Small pill switch for settings rows (theme, units).
const MiniSeg = <T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (v: T) => void;
}) => (
  <div role="radiogroup" aria-label={label} className="flex flex-none gap-0.5 rounded-full bg-muted p-0.5">
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={cn(
          'rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
          value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        )}
      >
        {text}
      </button>
    ))}
  </div>
);

// Initials ringed by this week's logging: seven segments, Monday first, lit on days with a meal.
const AVATAR = 64;
const AVATAR_R = 29;
const WeekAvatar = ({ initials, week }: { initials: string; week: boolean[] }) => {
  const c = 2 * Math.PI * AVATAR_R;
  const seg = c / 7;
  return (
    <div className="relative flex-none" style={{ width: AVATAR, height: AVATAR }}>
      <svg width={AVATAR} height={AVATAR} viewBox={`0 0 ${AVATAR} ${AVATAR}`} aria-hidden className="absolute inset-0">
        {week.map((on, i) => (
          <circle
            key={i}
            cx={AVATAR / 2}
            cy={AVATAR / 2}
            r={AVATAR_R}
            fill="none"
            stroke={on ? 'hsl(var(--primary))' : 'hsl(var(--foreground) / 0.14)'}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${seg - 6} ${c}`}
            strokeDashoffset={-i * seg - 3}
            transform={`rotate(-90 ${AVATAR / 2} ${AVATAR / 2})`}
          />
        ))}
      </svg>
      <span className="absolute inset-[7px] flex items-center justify-center rounded-full bg-muted font-display text-lg font-bold text-foreground">
        {initials}
      </span>
    </div>
  );
};

const Stat = ({ value, label }: { value: number; label: string }) => {
  const shown = useCountUp(value);
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl bg-background/40 px-2.5 py-2.5">
      <span className="font-display text-[22px] font-bold leading-none tracking-tight text-foreground">{shown.toLocaleString()}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
};

const JOURNEY_DAYS = 30;
const LINE_W = 300;
const LINE_H = 74;

// Last 30 days of weigh-ins as a line. Only drawn with two or more readings; nothing is filled in.
const WeightLine = ({ logs }: { logs: WeightLog[] }) => {
  const start = new Date();
  start.setDate(start.getDate() - (JOURNEY_DAYS - 1));
  const startDay = fmtLocalDate(start);
  const t0 = Date.parse(`${startDay}T00:00:00`);
  const kgs = logs.map((l) => l.weight_kg);
  const lo = Math.min(...kgs);
  const hi = Math.max(...kgs);
  const pad = Math.max(0.5, (hi - lo) * 0.2);
  const pts = logs.map((l) => {
    const x = ((Date.parse(`${l.logged_date}T00:00:00`) - t0) / 86_400_000 / (JOURNEY_DAYS - 1)) * LINE_W;
    const y = 6 + ((hi + pad - l.weight_kg) / (hi - lo + 2 * pad)) * (LINE_H - 14);
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const line = `M${pts.join(' L')}`;
  const first = pts[0].split(' ')[0];
  const last = pts[pts.length - 1].split(' ')[0];
  return (
    <svg viewBox={`0 0 ${LINE_W} ${LINE_H}`} preserveAspectRatio="none" aria-hidden className="my-2 block h-[74px] w-full">
      <defs>
        <linearGradient id="weight-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--chart-fiber))" stopOpacity="0.35" />
          <stop offset="1" stopColor="hsl(var(--chart-fiber))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${last} ${LINE_H} L${first} ${LINE_H} Z`} fill="url(#weight-fill)" />
      <path
        d={line}
        pathLength={1}
        fill="none"
        stroke="hsl(var(--chart-fiber))"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'draw 1200ms var(--ease-settle) 200ms forwards' }}
      />
    </svg>
  );
};

// BMI 15..35 mapped across the scale; the colour bands follow the standard cut-offs.
const bmiCategory = (bmi: number) => (bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese');
const BMI_SCALE =
  'linear-gradient(90deg, hsl(var(--chart-water)) 0 17.5%, hsl(var(--chart-fiber)) 17.5% 50%, hsl(var(--chart-carbs)) 50% 75%, hsl(var(--primary)) 75%)';

const Tile = ({ label, children, onClick }: { label: string; children: ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="elevation-card flex flex-col gap-1 p-3 text-left">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    {children}
  </button>
);

const TileValue = ({ value, unit }: { value: string; unit?: string }) => (
  <span className="font-display text-[22px] font-bold leading-tight tracking-tight text-foreground">
    {value}
    {unit && <span className="ml-0.5 font-sans text-[11px] font-medium text-faint">{unit}</span>}
  </span>
);

const SettingRow = ({ icon, tint, label, sub, children, onClick, danger }: {
  icon: ReactNode; tint: string; label: string; sub?: string; children?: ReactNode; onClick?: () => void; danger?: boolean;
}) => {
  const body = (
    <>
      <span className={cn('flex h-[30px] w-[30px] flex-none items-center justify-center rounded-[10px]', tint)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-medium', danger ? 'text-primary' : 'text-foreground')}>{label}</span>
        {sub && <span className="block truncate text-[11px] text-faint">{sub}</span>}
      </span>
      {children}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-[14px] py-3 text-left disabled:opacity-60">
      {body}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-[14px] py-3">{body}</div>
  );
};

const Profile = () => {
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { preference: themePreference, setTheme } = useTheme();
  const { isConnected: healthConnected, requestPermissions } = useHealthConnect();
  const { streak } = useStreak();
  const logStats = useLogStats();
  const { logs: weightLogs, latest: latestWeight } = useWeightLogs();

  const [microsOpen, setMicrosOpen] = useState(false);

  const [exporting, setExporting] = useState(false);
  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      await exportBackup(user.id);
    } catch (err) {
      // Closing the share sheet without picking anything also lands here; that's not a failure.
      if (!String(err).toLowerCase().includes('cancel')) {
        console.error('Export failed:', err);
        toast({ title: 'Export failed', description: 'Could not create your backup. Please try again.', variant: 'destructive' });
      }
    } finally {
      setExporting(false);
    }
  };

  const [profile, setProfile] = useState({
    name: '',
    age: '',
    weight: '',
    height: '',
    activityLevel: 'active',
    gender: 'male',
    goal: 'maintain',
  });

  const [savedTarget, setSavedTarget] = useState<{ targetWeight: number; targetDate: string; startWeight: number } | null>(null);
  const [macroGoals, setMacroGoals] = useState<MacroStrings>({ protein: '', carbs: '', fat: '', fiber: '' });
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lb'>('kg');

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
        if (meta.target_weight && meta.target_date && meta.goal_start_weight) {
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
      }
    };

    loadProfile();
  }, [user]);

  // Instant-apply preference toggles/selects — each writes immediately, independent of any other save
  const updateMeta = async (data: Record<string, unknown>) => {
    const { error } = await supabase.auth.updateUser({ data });
    if (error) {
      toast({ title: 'Error', description: 'Failed to save preference.', variant: 'destructive' });
    }
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

  const toDisplay = (kg: number) => (weightUnit === 'lb' ? kg * 2.20462 : kg);
  const kgToDisplay = (kgStr: string) => {
    const kg = parseFloat(kgStr);
    if (!kgStr || isNaN(kg)) return '';
    return toDisplay(kg).toFixed(1);
  };
  const displayToKg = (displayStr: string) => {
    const v = parseFloat(displayStr);
    if (isNaN(v)) return null;
    return weightUnit === 'lb' ? v / 2.20462 : v;
  };

  // The saved goal (what Today/History use). It changes only when Body/Plan is saved here,
  // not when a weigh-in updates profiles.weight.
  const calorieGoal = Number(user?.user_metadata?.calorie_goal) || computeCalorieGoal(profile, 2200);

  // Body and plan are read-only on the page; Edit opens one sheet that edits the
  // whole section and saves once. `base` is the section as it was when the sheet
  // opened, so every changed field can show its old value.
  const [editing, setEditing] = useState<'body' | 'plan' | null>(null);
  const [base, setBase] = useState<Draft | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [planBase, setPlanBase] = useState<PlanDraft | null>(null);
  const [plan, setPlan] = useState<PlanDraft | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const weightLimits = weightUnit === 'lb' ? [66, 550] : [30, 250];

  const openEditor = (section: 'body' | 'plan') => {
    const start: Draft = {
      weight: parseFloat(kgToDisplay(profile.weight)) || (weightUnit === 'lb' ? 154 : 70),
      height: parseInt(profile.height) || 170,
      age: parseInt(profile.age) || 30,
      gender: profile.gender,
      activityLevel: profile.activityLevel,
      goal: profile.goal,
    };
    const planStart: PlanDraft = {
      split: splitOf(macroGoals, calorieGoal),
      macros: macroGoals,
      targetWeight: savedTarget ? String(savedTarget.targetWeight) : '',
      targetDate: savedTarget?.targetDate ?? '',
    };
    setBase(start);
    setDraft(start);
    setPlanBase(planStart);
    setPlan(planStart);
    setEditing(section);
  };

  const patchDraft = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const patchPlan = (patch: Partial<PlanDraft>) => setPlan((p) => (p ? { ...p, ...patch } : p));
  const setDraftWeight = (v: number) => patchDraft({ weight: clamp(Math.round(v * 10) / 10, weightLimits[0], weightLimits[1]) });

  const changedKeys = draft && base ? (Object.keys(draft) as (keyof Draft)[]).filter((k) => draft[k] !== base[k]) : [];
  const draftProfile = draft && {
    ...profile,
    weight: (displayToKg(String(draft.weight)) ?? draft.weight).toFixed(1),
    height: String(draft.height),
    age: String(draft.age),
    gender: draft.gender,
    activityLevel: draft.activityLevel,
    goal: draft.goal,
  };
  const draftKcal = draftProfile ? computeCalorieGoal(draftProfile, calorieGoal) : calorieGoal;
  const draftBmi = draftProfile && (parseFloat(draftProfile.weight) / Math.pow(draft.height / 100, 2)).toFixed(1);

  // Writes only the fields that changed -- so opening a sheet on a profile with
  // no weight yet never saves the sheet's placeholder weight.
  const saveDraft = async () => {
    if (!user || !draftProfile || changedKeys.length === 0) return;
    const changed = (k: keyof Draft) => changedKeys.includes(k);
    const next = {
      ...profile,
      ...(changed('weight') && { weight: draftProfile.weight }),
      ...(changed('height') && { height: draftProfile.height }),
      ...(changed('age') && { age: draftProfile.age }),
      gender: draftProfile.gender,
      activityLevel: draftProfile.activityLevel,
      goal: draftProfile.goal,
    };
    const bodyUpdate: Record<string, number> = {};
    if (changed('weight')) bodyUpdate.weight = parseFloat(next.weight);
    if (changed('height')) bodyUpdate.height = parseInt(next.height);
    if (changed('age')) bodyUpdate.age = parseInt(next.age);

    setSavingDraft(true);
    const now = new Date().toISOString();
    const [bodyResult, metaResult, weightLogResult] = await Promise.all([
      Object.keys(bodyUpdate).length
        ? supabase.from('profiles').update({ ...bodyUpdate, updated_at: now }).eq('user_id', user.id)
        : Promise.resolve({ error: null }),
      supabase.auth.updateUser({
        data: {
          gender: next.gender,
          activity_level: next.activityLevel,
          weight_goal: next.goal,
          calorie_goal: computeCalorieGoal(next, calorieGoal),
        },
      }),
      // A weight change here is also today's weigh-in, so the history stays whole.
      changed('weight')
        ? supabase.from('weight_logs').upsert(
            { user_id: user.id, logged_date: fmtLocalDate(new Date()), weight_kg: bodyUpdate.weight, updated_at: now },
            { onConflict: 'user_id,logged_date' }
          )
        : Promise.resolve({ error: null }),
    ]);
    setSavingDraft(false);
    if (bodyResult.error || metaResult.error || weightLogResult.error) {
      toast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
      return;
    }
    setProfile(next);
    setEditing(null);
  };

  // Grams the plan sheet would save for protein/carbs/fat; null means "use the automatic split".
  const planMacros = (p: PlanDraft, kcal: number) => {
    if (p.split === 'balanced') return { protein: null, carbs: null, fat: null };
    if (p.split === 'custom') {
      const n = (s: string) => (s ? Number(s) : null);
      return { protein: n(p.macros.protein), carbs: n(p.macros.carbs), fat: n(p.macros.fat) };
    }
    return gramsFor(kcal, SPLITS[p.split]);
  };
  const planChanged =
    !!plan && !!planBase && (changedKeys.includes('goal') || JSON.stringify(plan) !== JSON.stringify(planBase));

  // One write for the whole plan: the goal (and the calorie target it sets), the macro split,
  // and the target weight/date -- the same user_metadata fields the old page saved separately.
  const savePlan = async () => {
    if (!user || !plan || !draftProfile || !planChanged) return;
    const goalChanged = changedKeys.includes('goal');
    const macros = planMacros(plan, draftKcal);
    const fiber = plan.split === 'custom' ? plan.macros.fiber : macroGoals.fiber;
    const targetChanged = plan.targetWeight && (!savedTarget || savedTarget.targetWeight !== parseFloat(plan.targetWeight));
    const goalStartWeight = targetChanged
      ? parseFloat(profile.weight) || 0
      : (savedTarget?.startWeight ?? (parseFloat(profile.weight) || 0));

    setSavingDraft(true);
    const { error } = await supabase.auth.updateUser({
      data: {
        ...(goalChanged && { weight_goal: draft!.goal, calorie_goal: draftKcal }),
        target_weight: plan.targetWeight ? parseFloat(plan.targetWeight) : null,
        target_date: plan.targetDate || null,
        goal_start_weight: plan.targetWeight ? goalStartWeight : null,
        protein_goal: macros.protein,
        carbs_goal: macros.carbs,
        fat_goal: macros.fat,
        fiber_goal: fiber ? Number(fiber) : null,
      },
    });
    setSavingDraft(false);
    if (error) {
      console.error('Error saving plan:', error);
      toast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive' });
      return;
    }
    const str = (n: number | null) => (n ? String(n) : '');
    if (goalChanged) setProfile((p) => ({ ...p, goal: draft!.goal }));
    setMacroGoals({ protein: str(macros.protein), carbs: str(macros.carbs), fat: str(macros.fat), fiber: fiber || '' });
    setSavedTarget(
      plan.targetWeight && plan.targetDate
        ? { targetWeight: parseFloat(plan.targetWeight), targetDate: plan.targetDate, startWeight: goalStartWeight }
        : null
    );
    setEditing(null);
    toast({ title: 'Plan saved', description: `${draftKcal.toLocaleString()} kcal a day.` });
  };

  const firstName = profile.name.trim().split(/\s+/)[0];
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

  const proteinGoal = Math.round(Number(macroGoals.protein) || (calorieGoal * 0.3) / 4);
  const carbsGoal = Math.round(Number(macroGoals.carbs) || (calorieGoal * 0.45) / 4);
  const fatGoal = Math.round(Number(macroGoals.fat) || (calorieGoal * 0.25) / 9);
  const fiberGoal = Math.round(Number(macroGoals.fiber) || 25);
  const macroKcal = proteinGoal * 4 + carbsGoal * 4 + fatGoal * 9;
  const waterGoalLiters = (WATER_GOAL_GLASSES * 0.25).toFixed(1);

  // Weight journey: the current weight is the latest weigh-in, else the profile weight.
  const journeyStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - (JOURNEY_DAYS - 1));
    return fmtLocalDate(d);
  })();
  const journeyLogs = weightLogs.filter((l) => l.logged_date >= journeyStart);
  const currentKg = latestWeight?.weight_kg ?? (parseFloat(profile.weight) || null);
  const journeyDelta = journeyLogs.length >= 2 ? journeyLogs[journeyLogs.length - 1].weight_kg - journeyLogs[0].weight_kg : null;
  const targetPct = (() => {
    if (!savedTarget || currentKg === null) return null;
    const span = savedTarget.startWeight - savedTarget.targetWeight;
    return span !== 0 ? clamp(Math.round(((savedTarget.startWeight - currentKg) / span) * 100), 0, 100) : 0;
  })();

  const bmi = parseFloat(profile.weight) && parseFloat(profile.height)
    ? parseFloat(profile.weight) / Math.pow(parseFloat(profile.height) / 100, 2)
    : null;

  const shownKcal = useCountUp(calorieGoal);
  const goalOption = optionOf(GOAL_OPTIONS, profile.goal);

  const previewSplit = plan
    ? plan.split === 'custom'
      ? (() => {
          const p = Number(plan.macros.protein) * 4 || 0;
          const c = Number(plan.macros.carbs) * 4 || 0;
          const f = Number(plan.macros.fat) * 9 || 0;
          const t = p + c + f;
          return t ? { p: Math.round((p / t) * 100), c: Math.round((c / t) * 100), f: Math.round((f / t) * 100) } : SPLITS.balanced;
        })()
      : SPLITS[plan.split]
    : SPLITS.balanced;
  const previewGrams = plan && plan.split !== 'custom' ? gramsFor(draftKcal, SPLITS[plan.split]) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MenuButton />
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">You</h1>
      </div>

      {/* Identity: who you are, this week's logging, and the all-time numbers */}
      <section
        className="motion-rise relative flex flex-col gap-3.5 overflow-hidden rounded-[28px] p-4"
        style={{
          ...rise(0),
          background:
            'radial-gradient(120% 90% at 0% 0%, hsl(var(--primary) / 0.28), transparent 60%), radial-gradient(90% 80% at 100% 100%, hsl(var(--chart-carbs) / 0.14), transparent 60%), hsl(var(--card))',
        }}
      >
        <div className="flex items-center gap-3">
          <WeekAvatar initials={initials} week={logStats?.week ?? Array(7).fill(false)} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-[21px] font-bold leading-tight tracking-tight text-foreground">
              {firstName || 'Your name'}
            </div>
            {memberSince && <div className="mt-0.5 text-[11px] text-muted-foreground">Member since {memberSince}</div>}
            {streak > 0 && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-chart-fiber/20 px-2 py-1 text-[11px] font-semibold text-chart-fiber">
                <Flame className="h-3 w-3" />
                {streak}-day streak
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          <Stat value={logStats?.daysLogged ?? 0} label="Days logged" />
          <Stat value={logStats?.meals ?? 0} label="Meals" />
          <Stat value={logStats?.bestStreak ?? 0} label="Best streak" />
        </div>
      </section>

      {/* Weight journey */}
      <section className="elevation-card motion-rise space-y-1 p-4" style={rise(1)}>
        <div className="flex items-center justify-between">
          <span className="font-display text-[15px] font-semibold text-foreground">Weight journey</span>
          <span className="text-[11px] text-faint">Last {JOURNEY_DAYS} days</span>
        </div>
        {currentKg !== null ? (
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-[34px] font-bold leading-none tracking-tight text-foreground">{toDisplay(currentKg).toFixed(1)}</span>
              <span className="text-sm text-muted-foreground">{weightUnit}</span>
            </span>
            {journeyDelta !== null && Math.abs(journeyDelta) >= 0.05 && (
              <span className="rounded-full bg-chart-fiber/20 px-2 py-1 text-[11px] font-bold text-chart-fiber">
                {journeyDelta < 0 ? '↓' : '↑'} {toDisplay(Math.abs(journeyDelta)).toFixed(1)} {weightUnit}
              </span>
            )}
          </div>
        ) : (
          <p className="pt-1 text-sm text-muted-foreground">Log your weight on Today to start the line.</p>
        )}
        {journeyLogs.length >= 2 && <WeightLine logs={journeyLogs} />}
        {savedTarget && targetPct !== null ? (
          <div className="pt-2">
            <div className="relative h-2 rounded-full bg-muted">
              <div
                className="motion-grow absolute inset-y-0 left-0 origin-left rounded-full bg-chart-fiber"
                style={{ width: `${targetPct}%`, animationDelay: '300ms' }}
              />
              <div
                className="motion-pop absolute top-1/2 -ml-2 -mt-2 h-4 w-4 rounded-full border-[3px] border-card bg-foreground"
                style={{ left: `${targetPct}%`, animationDelay: '900ms' }}
              />
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-faint">
              <span>Start <b className="font-semibold text-foreground">{toDisplay(savedTarget.startWeight).toFixed(1)}</b></span>
              <span>{targetPct}% there</span>
              <span>
                Goal <b className="font-semibold text-foreground">{toDisplay(savedTarget.targetWeight).toFixed(1)}</b> by{' '}
                {new Date(savedTarget.targetDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => openEditor('plan')} className="pt-1 text-[13px] font-semibold text-primary">
            Set a target weight
          </button>
        )}
      </section>

      {/* Your daily plan */}
      <section className="elevation-card motion-rise space-y-3 p-4" style={rise(2)}>
        <SectionLabel onEdit={() => openEditor('plan')} editLabel="Edit plan">Your daily plan</SectionLabel>
        <div className="flex items-center gap-3.5">
          <MacroRing protein={proteinGoal} carbs={carbsGoal} fat={fatGoal} size={108} stroke={11} animate>
            <span className="font-display text-[25px] font-bold leading-none tracking-tight text-foreground">{shownKcal.toLocaleString()}</span>
            <span className="text-[10px] text-muted-foreground">kcal a day</span>
          </MacroRing>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="self-start rounded-full bg-primary/20 px-2.5 py-1 text-[11px] font-bold text-primary">
              {goalOption?.long ?? 'Maintain weight'}
            </span>
            <p className="text-xs leading-snug text-muted-foreground">
              Worked out from your body and activity. {goalOption?.hint}.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'Protein', grams: proteinGoal, share: (proteinGoal * 4) / macroKcal, bar: 'bg-chart-protein' },
            { label: 'Carbs', grams: carbsGoal, share: (carbsGoal * 4) / macroKcal, bar: 'bg-chart-carbs' },
            { label: 'Fat', grams: fatGoal, share: (fatGoal * 9) / macroKcal, bar: 'bg-chart-fat' },
            { label: 'Fibre', grams: fiberGoal, share: 1, bar: 'bg-chart-fiber' },
          ].map((m, i) => (
            <div key={m.label} className="flex flex-col gap-1.5 rounded-2xl bg-muted p-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] text-muted-foreground">{m.label}</span>
                <span className="font-display text-[17px] font-bold text-foreground">{m.grams} g</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-background/40">
                <div
                  className={cn('motion-grow h-full origin-left rounded-full', m.bar)}
                  style={{ width: `${Math.round(m.share * 100)}%`, animationDelay: `${i * 90}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { icon: <Droplet className="h-3.5 w-3.5" />, tint: 'bg-chart-water/20 text-chart-water', value: `${waterGoalLiters} L`, label: 'Water' },
            { icon: <Footprints className="h-3.5 w-3.5" />, tint: 'bg-chart-steps/20 text-chart-steps', value: STEP_GOAL.toLocaleString(), label: 'Steps' },
            { icon: <Sparkles className="h-3.5 w-3.5" />, tint: 'bg-chart-fat/20 text-chart-fat', value: String(MICRO_GOALS.length), label: 'Micros' },
          ].map((c) => (
            <div key={c.label} className="flex items-center gap-2 rounded-[14px] bg-muted px-2.5 py-2">
              <span className={cn('flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px]', c.tint)}>{c.icon}</span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-foreground">{c.value}</span>
                <span className="block text-[10px] text-faint">{c.label}</span>
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMicrosOpen((v) => !v)}
          aria-expanded={microsOpen}
          className="flex w-full items-center justify-between border-t border-border pt-3"
        >
          <span className="text-[13px] text-foreground">Micronutrient goals</span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="flex gap-[3px]">
              {MICRO_GOALS.slice(0, 5).map((m) => (
                <span key={m.label} className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
              ))}
            </span>
            {microsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </span>
        </button>
        {microsOpen && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {MICRO_GOALS.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn('h-[7px] w-[7px] rounded-sm', row.dot)} />
                  <span className="text-xs text-foreground">{row.label}</span>
                </div>
                <span className="font-mono text-xs font-medium tabular-nums text-muted-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Body as tiles; Edit (or any tile) opens the body sheet */}
      <section className="motion-rise space-y-2" style={rise(3)}>
        <SectionLabel onEdit={() => openEditor('body')}>Body</SectionLabel>
        <div className="grid grid-cols-2 gap-1.5">
          <Tile label="Weight" onClick={() => openEditor('body')}>
            <TileValue value={kgToDisplay(profile.weight) || '—'} unit={weightUnit} />
          </Tile>
          <Tile label="Height" onClick={() => openEditor('body')}>
            <TileValue value={profile.height || '—'} unit="cm" />
          </Tile>
          <Tile label={`Age · ${optionOf(GENDER_OPTIONS, profile.gender)?.label ?? '—'}`} onClick={() => openEditor('body')}>
            <TileValue value={profile.age || '—'} unit="yrs" />
          </Tile>
          <Tile label={bmi ? `BMI · ${bmiCategory(bmi)}` : 'BMI'} onClick={() => openEditor('body')}>
            <TileValue value={bmi ? bmi.toFixed(1) : '—'} />
            {bmi && (
              <span className="relative mt-1.5 block h-1.5 rounded-full" style={{ background: BMI_SCALE }}>
                <span
                  className="absolute -top-[3px] h-3 w-[3px] -translate-x-1/2 rounded-sm bg-foreground"
                  style={{ left: `${clamp(((bmi - 15) / 20) * 100, 0, 100)}%` }}
                />
              </span>
            )}
          </Tile>
        </div>
        <button
          type="button"
          onClick={() => openEditor('body')}
          className="elevation-card flex w-full items-center justify-between px-[14px] py-3 text-left"
        >
          <span>
            <span className="block text-[11px] text-muted-foreground">Activity</span>
            <span className="block text-sm font-semibold text-foreground">
              {optionOf(ACTIVITY_OPTIONS, profile.activityLevel)?.label ?? '—'}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-faint">
            {optionOf(ACTIVITY_OPTIONS, profile.activityLevel)?.hint}
            <ChevronRight className="h-4 w-4" />
          </span>
        </button>
      </section>

      <Drawer open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DrawerContent className="max-h-[92vh] rounded-t-[26px] border-border bg-card">
          <DrawerTitle className="sr-only">{editing === 'plan' ? 'Edit plan' : 'Edit body'}</DrawerTitle>
          {draft && base && plan && (
            <div className="space-y-3.5 overflow-y-auto px-[18px] pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-3">
              <div className="flex h-7 items-center justify-between">
                <div className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {editing === 'plan' ? 'Edit plan' : 'Edit body'}
                </div>
                <button type="button" onClick={() => setEditing(null)} className="py-2 text-[13px] font-medium text-muted-foreground">
                  Discard
                </button>
              </div>

              {/* Pinned so every change shows what it does to the target before it saves */}
              <div className="flex items-center justify-between gap-3 rounded-[14px] border border-border bg-muted/50 px-[14px] py-[13px]">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-muted-foreground">Daily target</span>
                  <span className="font-mono text-[10px] text-muted-foreground">BMI {draftBmi} · live</span>
                </div>
                <div className="flex items-baseline gap-[7px]">
                  {draftKcal !== calorieGoal && (
                    <span className="font-mono text-xs text-muted-foreground line-through">{calorieGoal.toLocaleString()}</span>
                  )}
                  <span className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">{draftKcal.toLocaleString()}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">kcal</span>
                </div>
              </div>

              {editing === 'body' ? (
                <>
                  <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-background">
                    <StepperRow
                      label="Weight"
                      value={draft.weight.toFixed(1)}
                      unit={weightUnit}
                      was={draft.weight !== base.weight ? `was ${base.weight.toFixed(1)}` : undefined}
                      onStep={(dir) => setDraftWeight(draft.weight + dir * 0.1)}
                    >
                      <WeightRuler value={draft.weight} onChange={setDraftWeight} />
                    </StepperRow>
                    <StepperRow
                      label="Height"
                      value={String(draft.height)}
                      unit="cm"
                      was={draft.height !== base.height ? `was ${base.height}` : undefined}
                      onStep={(dir) => patchDraft({ height: clamp(draft.height + dir, 120, 230) })}
                    />
                    <StepperRow
                      label="Age"
                      value={String(draft.age)}
                      unit="yrs"
                      was={draft.age !== base.age ? `was ${base.age}` : undefined}
                      onStep={(dir) => patchDraft({ age: clamp(draft.age + dir, 13, 100) })}
                    />
                  </div>
                  <SegmentedField
                    label="Gender"
                    options={GENDER_OPTIONS}
                    value={draft.gender}
                    base={base.gender}
                    onChange={(gender) => patchDraft({ gender })}
                  />
                  <SegmentedField
                    label="Activity"
                    options={ACTIVITY_OPTIONS}
                    value={draft.activityLevel}
                    base={base.activityLevel}
                    onChange={(activityLevel) => patchDraft({ activityLevel })}
                  />
                  <button
                    type="button"
                    onClick={saveDraft}
                    disabled={changedKeys.length === 0 || savingDraft}
                    className={cn(
                      'h-[52px] w-full rounded-[14px] text-sm',
                      changedKeys.length
                        ? 'bg-primary font-semibold text-primary-foreground active:bg-primary/90'
                        : 'border border-border bg-muted font-medium text-muted-foreground'
                    )}
                  >
                    {savingDraft
                      ? 'Saving…'
                      : changedKeys.length
                        ? `Save ${changedKeys.length} change${changedKeys.length === 1 ? '' : 's'} · ${draftKcal.toLocaleString()} kcal`
                        : 'Saved · nothing pending'}
                  </button>
                </>
              ) : (
                <>
                  <SegmentedField
                    label="Goal"
                    options={GOAL_OPTIONS}
                    value={draft.goal}
                    base={base.goal}
                    onChange={(goal) => patchDraft({ goal })}
                  />

                  <div className="space-y-2">
                    <span className="text-sm text-foreground">Macro split</span>
                    <div className="flex h-[34px] gap-0.5 overflow-hidden rounded-xl">
                      {([['P', previewSplit.p, 'bg-chart-protein'], ['C', previewSplit.c, 'bg-chart-carbs'], ['F', previewSplit.f, 'bg-chart-fat']] as const).map(
                        ([k, pct, bg]) =>
                          pct > 0 && (
                            <div
                              key={k}
                              className={cn('flex items-center justify-center text-[11px] font-bold text-black/75 transition-[flex-grow] duration-300', bg)}
                              style={{ flexGrow: pct }}
                            >
                              {k} {pct}%
                            </div>
                          )
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {([...Object.entries(SPLITS).map(([k, s]) => [k, s.label]), ['custom', 'Custom']] as [SplitKey, string][]).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() =>
                            patchPlan({
                              split: k,
                              // Custom starts from the split shown now, so there's something to adjust.
                              ...(k === 'custom' && plan.split !== 'custom' && previewGrams && {
                                macros: { ...plan.macros, protein: String(previewGrams.protein), carbs: String(previewGrams.carbs), fat: String(previewGrams.fat) },
                              }),
                            })
                          }
                          className={cn(
                            'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                            plan.split === k ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {previewGrams ? (
                      <p className="font-mono text-[11px] text-muted-foreground">
                        Protein {previewGrams.protein} g · Carbs {previewGrams.carbs} g · Fat {previewGrams.fat} g
                      </p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2">
                        {(['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => (
                          <label key={k} className="space-y-1">
                            <span className="block text-[10px] text-muted-foreground">{MACRO_LABEL[k]} (g)</span>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min="0"
                              value={plan.macros[k]}
                              onChange={(e) => patchPlan({ macros: { ...plan.macros, [k]: e.target.value } })}
                              placeholder={k === 'fiber' ? '25' : String(gramsFor(draftKcal, SPLITS.balanced)[k])}
                              className="h-10 rounded-lg border-border bg-background px-2 text-sm"
                            />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="space-y-1.5">
                      <span className="block text-sm text-foreground">Target weight (kg)</span>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        value={plan.targetWeight}
                        onChange={(e) => patchPlan({ targetWeight: e.target.value })}
                        placeholder="Kilograms"
                        className="h-11 rounded-xl border-border bg-background"
                      />
                    </label>
                    <label className="space-y-1.5">
                      <span className="block text-sm text-foreground">By</span>
                      <Input
                        type="date"
                        value={plan.targetDate}
                        min={fmtLocalDate(new Date())}
                        onChange={(e) => patchPlan({ targetDate: e.target.value })}
                        className="h-11 rounded-xl border-border bg-background"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={savePlan}
                    disabled={!planChanged || savingDraft}
                    className={cn(
                      'h-[52px] w-full rounded-full text-sm',
                      planChanged
                        ? 'bg-primary font-semibold text-primary-foreground active:bg-primary/90'
                        : 'border border-border bg-muted font-medium text-muted-foreground'
                    )}
                  >
                    {savingDraft ? 'Saving…' : planChanged ? `Save · ${draftKcal.toLocaleString()} kcal a day` : 'Saved · nothing pending'}
                  </button>
                </>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Settings */}
      <section className="motion-rise space-y-2" style={rise(4)}>
        <SectionLabel>Settings</SectionLabel>
        <div className="elevation-card divide-y divide-border overflow-hidden p-0">
          <SettingRow icon={<Moon className="h-4 w-4" />} tint="bg-chart-fat/20 text-chart-fat" label="Theme">
            <MiniSeg
              label="Theme"
              options={[['dark', 'Dark'], ['light', 'Light'], ['system', 'Auto']] as const}
              value={themePreference}
              onChange={setTheme}
            />
          </SettingRow>
          <SettingRow
            icon={<Activity className="h-4 w-4" />}
            tint="bg-chart-fiber/20 text-chart-fiber"
            label="Google Fit"
            sub={healthConnected ? 'Steps and calories from Health Connect' : 'Not connected'}
          >
            <Switch checked={healthConnected} onCheckedChange={handleGoogleFitChange} />
          </SettingRow>
          <SettingRow icon={<Scale className="h-4 w-4" />} tint="bg-chart-carbs/20 text-chart-carbs" label="Weight unit">
            <MiniSeg label="Weight unit" options={[['kg', 'kg'], ['lb', 'lb']] as const} value={weightUnit} onChange={handleWeightUnitChange} />
          </SettingRow>
          <SettingRow
            icon={<Download className="h-4 w-4" />}
            tint="bg-chart-water/20 text-chart-water"
            label={exporting ? 'Preparing backup…' : 'Export my data'}
            sub="All meals, habits and weights as a file"
            onClick={exporting ? undefined : handleExport}
          >
            <ChevronRight className="h-4 w-4 text-faint" />
          </SettingRow>
          <SettingRow icon={<LogOut className="h-4 w-4" />} tint="bg-primary/20 text-primary" label="Sign out" danger onClick={() => signOut()} />
        </div>
        <p className="pt-1 text-center font-mono text-[11px] text-faint">Bite Balance 2.0.1 · build 214</p>
      </section>
    </div>
  );
};

export default Profile;
