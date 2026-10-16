import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Sparkles,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';
import AddFoodForm, { type AddFoodFormProps } from '@/components/AddFoodForm';
import { fmtLocalDate } from '@/lib/utils';
import { ChatMealItem, MEAL_LABEL, MEAL_ORDER, MICRO, chatMealItemToRow } from '@/components/MealReviewList';
import { defaultSlotForNow } from '@/lib/mealTime';

const MICRO_KEYS = MICRO.map((m) => m.key);
const NUTRIENT_KEYS = ['calories', 'protein', 'carbs', 'fat', 'fiber', ...MICRO_KEYS] as const;
type NutrientKey = (typeof NUTRIENT_KEYS)[number];

function mapNutrients<T>(f: (k: NutrientKey) => T) {
  return Object.fromEntries(NUTRIENT_KEYS.map((k) => [k, f(k)])) as Record<NutrientKey, T>;
}

const AddMeal = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { closeAddMeal, notifyMealsLogged, initialMealTime } = useAddMealSheet();
  const [loading, setLoading] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);

  // Prefill for the "Save as food" dialog; the dialog is open while this is set.
  const [foodDraft, setFoodDraft] = useState<AddFoodFormProps['initial'] | null>(null);

  // Saved foods are per serving (calories and macros for serving_size), so the meal's
  // portion becomes the serving and its totals carry over as-is.
  const openSaveAsCustomFood = () =>
    setFoodDraft({
      name: mealData.name,
      serving_size: portionWeight || '100',
      serving_unit: portionUnit,
      calories: String(Math.round(Number(mealData.calories) || 0)),
      ...Object.fromEntries(
        (['protein', 'carbs', 'fat', 'fiber'] as const).map((k) => [k, String(Math.round((Number(mealData[k]) || 0) * 10) / 10)])
      ),
    });

  const [baseNutrition, setBaseNutrition] = useState<
    (Record<NutrientKey, number> & { servingSizeWeight: number }) | null
  >(null);
  const [portionWeight, setPortionWeight] = useState<string>('100');
  // 'g', or a count unit like 'eggs' when auto-fill matched one of your own foods.
  const [portionUnit, setPortionUnit] = useState('g');

  const emptyMeal = () => ({ name: '', mealTime: initialMealTime ?? defaultSlotForNow(), ...mapNutrients(() => '') });
  const [mealData, setMealData] = useState(emptyMeal);

  const handlePortionWeightChange = (newWeightStr: string) => {
    setPortionWeight(newWeightStr);
    const newWeight = parseFloat(newWeightStr);

    if (baseNutrition && !isNaN(newWeight) && newWeight > 0) {
      const ratio = newWeight / baseNutrition.servingSizeWeight;
      const scale = (n: number) => String(Math.round(n * ratio * 10) / 10);
      setMealData((prev) => ({
        ...prev,
        ...mapNutrients((k) => scale(baseNutrition[k])),
        calories: String(Math.round(baseNutrition.calories * ratio)),
      }));
    }
  };

  const updateBaseNutritionFromForm = (field: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    const currentWeight = parseFloat(portionWeight) || 100;

    setBaseNutrition((prev) => {
      const currentBase = prev || { ...mapNutrients(() => 0), servingSizeWeight: 100 };

      const ratio = currentBase.servingSizeWeight / currentWeight;

      return {
        ...currentBase,
        [field]: numVal * ratio,
      };
    });
  };

  const handleAutoFill = async () => {
    const text = mealData.name.trim();
    if (!text || text.length < 3) return;

    setAutoFilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-meal', {
        body: { text },
      });

      if (error) throw error;

      if (data) {
        // Try to parse weight directly from what they typed, e.g. '150g'
        const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(g|grams|gram|oz|ounces|ounce)/i);
        let parsedWeight = 100;
        if (data.portion) {
          parsedWeight = data.portion.amount;
        } else if (weightMatch) {
          const val = parseFloat(weightMatch[1]);
          const unit = weightMatch[2].toLowerCase();
          parsedWeight = unit.startsWith('oz') ? Math.round(val * 28.35) : val;
        }

        // Micros may be missing from parse-meal's reply (default 0); macros pass through as-is.
        const fromData = (k: NutrientKey): number =>
          MICRO_KEYS.some((m) => m === k) ? data[k] ?? 0 : data[k];
        setBaseNutrition({ ...mapNutrients(fromData), servingSizeWeight: parsedWeight });
        setPortionWeight(String(parsedWeight));
        setPortionUnit(data.portion?.unit ?? 'g');

        setMealData({
          ...mealData,
          name: data.name,
          ...mapNutrients((k) => String(fromData(k))),
        });

        toast({
          title: 'Macros Auto-Filled!',
          description: `Calculated values for: ${data.name}`,
        });
      }
    } catch (err) {
      console.error('Error auto-filling macros:', err);
      toast({
        title: 'Auto-fill Failed',
        description: 'Could not identify macros. Please enter them manually.',
        variant: 'destructive',
      });
    } finally {
      setAutoFilling(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to add meals',
        variant: 'destructive',
      });
      return;
    }

    if (!mealData.name || !mealData.mealTime || !mealData.calories) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const item: ChatMealItem = {
        name: mealData.name,
        mealTime: mealData.mealTime,
        grams: portionUnit === 'g' ? Number(portionWeight) : 0,
        ...mapNutrients((k) => Number(mealData[k]) || 0),
        calories: Number(mealData.calories),
      };
      const { error } = await supabase
        .from('daily_meals')
        .insert(chatMealItemToRow(item, user.id, fmtLocalDate(new Date())));

      if (error) throw error;

      toast({
        title: 'Meal added',
        description: `"${mealData.name}" has been added to your daily log.`,
      });

      setMealData(emptyMeal());
      setBaseNutrition(null);
      setPortionUnit('g');

      notifyMealsLogged();
      closeAddMeal();
    } catch (error) {
      console.error('Error adding meal:', error);
      toast({
        title: 'Error',
        description: 'Failed to add meal. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const autoFillState: 'empty' | 'offered' | 'calculating' | 'filled' = autoFilling
    ? 'calculating'
    : baseNutrition
      ? 'filled'
      : mealData.name.trim().length >= 3
        ? 'offered'
        : 'empty';

  const macroFields = [
    { key: 'protein' as const, label: 'Protein', dot: 'bg-chart-protein', text: 'text-chart-protein', bg: 'bg-chart-protein/10', border: 'border-chart-protein/25', kcalPerGram: 4 },
    { key: 'carbs' as const, label: 'Carbs', dot: 'bg-chart-carbs', text: 'text-chart-carbs', bg: 'bg-chart-carbs/10', border: 'border-chart-carbs/25', kcalPerGram: 4 },
    { key: 'fat' as const, label: 'Fats', dot: 'bg-chart-fat', text: 'text-chart-fat', bg: 'bg-chart-fat/10', border: 'border-chart-fat/25', kcalPerGram: 9 },
    { key: 'fiber' as const, label: 'Fiber', dot: 'bg-chart-fiber', text: 'text-chart-fiber', bg: 'bg-chart-fiber/10', border: 'border-chart-fiber/25', kcalPerGram: 0 },
  ];

  const proteinKcal = (Number(mealData.protein) || 0) * 4;
  const carbsKcal = (Number(mealData.carbs) || 0) * 4;
  const fatKcal = (Number(mealData.fat) || 0) * 9;
  const macroKcalTotal = proteinKcal + carbsKcal + fatKcal;

  const canSaveAsFood = mealData.name.trim().length >= 3 && !!mealData.calories;

  return (
    <div className="px-4 pb-6 pt-2">
      {/* Meal slot picker: one pill slides to the chosen slot */}
      <div role="radiogroup" aria-label="Meal" className="relative mb-6 grid h-11 grid-cols-4 rounded-full bg-muted p-1">
        <span
          aria-hidden
          className="absolute bottom-1 left-1 top-1 rounded-full bg-foreground transition-transform [transition-duration:420ms] [transition-timing-function:var(--ease-pop)]"
          style={{ width: 'calc((100% - 8px) / 4)', transform: `translateX(${Math.max(0, MEAL_ORDER.indexOf(mealData.mealTime as (typeof MEAL_ORDER)[number])) * 100}%)` }}
        />
        {MEAL_ORDER.map((slot) => {
          const isActive = mealData.mealTime === slot;
          return (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => setMealData({ ...mealData, mealTime: slot })}
              className={`relative rounded-full text-[13px] font-semibold transition-colors ${isActive ? 'text-background' : 'text-muted-foreground'}`}
            >
              {MEAL_LABEL[slot]}
            </button>
          );
        })}
      </div>

            <div className="elevation-card space-y-4 p-4">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Meal name card */}
                <div
                  className={`space-y-3 rounded-2xl border p-4 transition-colors ${
                    autoFillState === 'offered' || autoFillState === 'calculating'
                      ? 'border-primary/45 bg-muted shadow-[0_0_0_3px_hsl(var(--primary)/0.1)]'
                      : 'border-border bg-muted'
                  }`}
                >
                  <span className="text-[12px] font-semibold text-muted-foreground">
                    Meal name
                  </span>
                  <input
                    id="name"
                    value={mealData.name}
                    onChange={(e) => setMealData({ ...mealData, name: e.target.value })}
                    placeholder="Chicken breast, 150 g"
                    className="block w-full bg-transparent text-lg font-medium text-foreground placeholder:text-faint focus:outline-none"
                    required
                  />

                  {autoFillState !== 'empty' && <div className="h-px bg-border" />}

                  {autoFillState === 'offered' && (
                    <div className="flex items-center gap-3">
                      <p className="flex-1 text-[11px] text-muted-foreground">
                        Let AI estimate the portion and macros
                      </p>
                      <Button
                        type="button"
                        onClick={handleAutoFill}
                        className="h-10 flex-none gap-1.5 rounded-[11px] border border-primary/38 bg-primary/14 px-3.5 text-xs font-semibold text-primary hover:bg-primary/20"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Auto-fill Macros
                      </Button>
                    </div>
                  )}

                  {autoFillState === 'calculating' && (
                    <>
                      <div className="flex items-center gap-3">
                        <p className="flex-1 text-[11px] text-muted-foreground">
                          parse-meal is estimating the macros
                        </p>
                        <div className="flex h-10 flex-none items-center gap-2 rounded-[11px] border border-primary/24 bg-primary/10 px-3.5 text-xs font-semibold text-primary">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Calculating...
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[0, 1, 2, 3].map((i) => (
                          <div key={i} className="h-[52px] rounded-[10px] bg-muted-foreground/10" />
                        ))}
                      </div>
                    </>
                  )}

                  {autoFillState === 'filled' && (
                    <div className="flex items-center gap-3">
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5 flex-none text-chart-fiber" />
                        <p className="truncate text-[11px] text-chart-fiber">Filled by AI · edit anything</p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAutoFill}
                        disabled={autoFilling}
                        className="h-10 flex-none gap-1.5 rounded-[11px] text-xs font-semibold"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Redo
                      </Button>
                    </div>
                  )}
                </div>

                {/* Portion + Calories */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-2 rounded-2xl border border-border bg-muted/60 p-3.5">
                    <span className="text-[12px] font-semibold text-muted-foreground">
                      Portion
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <input
                        id="portionWeight"
                        type="number"
                        value={portionWeight}
                        onChange={(e) => handlePortionWeightChange(e.target.value)}
                        placeholder="—"
                        className="w-full min-w-0 bg-transparent font-mono text-2xl font-semibold tabular-nums text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                      />
                      <span className="flex-none text-xs text-muted-foreground">{portionUnit}</span>
                    </div>
                    {baseNutrition && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Base serving: {baseNutrition.servingSizeWeight}{portionUnit === 'g' ? 'g' : ` ${portionUnit}`}
                      </p>
                    )}
                  </div>

                  <div
                    className={`space-y-2 rounded-2xl border p-3.5 ${
                      mealData.calories ? 'border-primary/25 bg-primary/[0.07]' : 'border-border bg-muted/60'
                    }`}
                  >
                    <span
                      className={`text-[12px] font-semibold ${
                        mealData.calories ? 'text-primary/75' : 'text-muted-foreground'
                      }`}
                    >
                      Calories
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <input
                        id="calories"
                        type="number"
                        value={mealData.calories}
                        onChange={(e) => {
                          setMealData({ ...mealData, calories: e.target.value });
                          updateBaseNutritionFromForm('calories', e.target.value);
                        }}
                        placeholder="—"
                        className="w-full min-w-0 bg-transparent font-mono text-2xl font-semibold tabular-nums text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                        required
                      />
                      <span className={`flex-none text-xs ${mealData.calories ? 'text-primary/70' : 'text-muted-foreground'}`}>
                        kcal
                      </span>
                    </div>
                    {Number(mealData.calories) > 0 && portionUnit === 'g' && (
                      <p className="font-mono text-[10px] text-primary/60">
                        {((Number(mealData.calories) / (Number(portionWeight) || 100)) * 100).toFixed(1)} per 100g
                      </p>
                    )}
                  </div>
                </div>

                {/* Macronutrients */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12px] font-semibold text-muted-foreground">
                      Macronutrients
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">grams</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {macroFields.map((m) => {
                      const value = mealData[m.key];
                      const hasValue = Number(value) > 0;
                      return (
                        <div
                          key={m.key}
                          className={`flex min-h-[72px] flex-col items-center justify-center gap-2 rounded-xl border p-2 ${
                            hasValue ? `${m.bg} ${m.border}` : 'border-border bg-muted/60'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                            <span className={`text-[10px] ${hasValue ? m.text : 'text-muted-foreground'}`}>{m.label}</span>
                          </div>
                          <input
                            id={m.key}
                            type="number"
                            step="0.1"
                            value={value}
                            onChange={(e) => {
                              setMealData({ ...mealData, [m.key]: e.target.value });
                              updateBaseNutritionFromForm(m.key, e.target.value);
                            }}
                            placeholder="—"
                            className="w-full bg-transparent text-center font-mono text-lg font-semibold tabular-nums text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex h-[5px] overflow-hidden rounded-full bg-muted">
                    {macroKcalTotal > 0 && (
                      <>
                        <div className="bg-chart-protein" style={{ width: `${(proteinKcal / macroKcalTotal) * 100}%` }} />
                        <div className="bg-chart-carbs" style={{ width: `${(carbsKcal / macroKcalTotal) * 100}%` }} />
                        <div className="bg-chart-fat" style={{ width: `${(fatKcal / macroKcalTotal) * 100}%` }} />
                      </>
                    )}
                  </div>
                </div>

                {/* Save as reusable food, or a hint while the meal isn't ready to save */}
                {canSaveAsFood ? (
                  <button
                    type="button"
                    onClick={openSaveAsCustomFood}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 text-sm font-medium text-primary hover:bg-primary/15"
                  >
                    <Plus className="h-4 w-4" />
                    Save as reusable food
                  </button>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Fill what you know. Anything left blank stays out of your totals.
                  </p>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-xl text-base font-semibold ${
                    mealData.calories ? '' : 'bg-muted text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {loading ? (
                    'Adding...'
                  ) : mealData.calories ? (
                    <>
                      Add to {MEAL_LABEL[mealData.mealTime]}
                      <span className="h-4 w-px bg-primary-foreground/30" />
                      <span className="font-mono tabular-nums">{mealData.calories} kcal</span>
                    </>
                  ) : (
                    'Add meal'
                  )}
                </Button>
              </form>
            </div>

      {/* Save as food: the same form as Saved > Add a food, prefilled from this meal */}
      <Dialog open={!!foodDraft} onOpenChange={(open) => !open && setFoodDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto border-none bg-transparent p-0 shadow-none [&>button]:hidden">
          <DialogTitle className="sr-only">Save as food</DialogTitle>
          {foodDraft && (
            <AddFoodForm initial={foodDraft} onFoodAdded={() => setFoodDraft(null)} onCancel={() => setFoodDraft(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddMeal;
