import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Edit3,
  Sparkles,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createCustomFood } from '@/services/foodService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import ChatMealLog from '@/components/ChatMealLog';
import { useAddMealSheet } from '@/contexts/AddMealSheetContext';

const categories = [
  { id: 'rice_grains', name: 'Rice & Grains', icon: '🍚' },
  { id: 'south_indian', name: 'South Indian', icon: '🥞' },
  { id: 'north_indian', name: 'North Indian', icon: '🫓' },
  { id: 'curries', name: 'Curries', icon: '🍛' },
  { id: 'vegetables', name: 'Vegetables', icon: '🥦' },
  { id: 'fruits', name: 'Fruits', icon: '🍎' },
  { id: 'dairy', name: 'Dairy', icon: '🧀' },
  { id: 'eggs', name: 'Eggs', icon: '🥚' },
  { id: 'chicken', name: 'Chicken', icon: '🍗' },
  { id: 'meat', name: 'Meat', icon: '🥩' },
  { id: 'seafood', name: 'Seafood', icon: '🐟' },
  { id: 'snacks', name: 'Snacks', icon: '🥟' },
  { id: 'beverages', name: 'Beverages', icon: '☕' },
];

const AddMeal = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { closeAddMeal, notifyMealsLogged } = useAddMealSheet();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chat');
  const [autoFilling, setAutoFilling] = useState(false);

  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [aliasDraft, setAliasDraft] = useState('');
  const [customFoodForm, setCustomFoodForm] = useState({
    name: '',
    category: 'south_indian',
    serving_size: '100',
    serving_unit: 'g',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    aliases: '',
  });
  const aliasChips = customFoodForm.aliases.split(',').map((a) => a.trim()).filter(Boolean);

  const handleCreateCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to save custom foods',
        variant: 'destructive',
      });
      return;
    }

    try {
      const created = await createCustomFood({
        name: customFoodForm.name,
        category: customFoodForm.category,
        serving_size: Number(customFoodForm.serving_size) || 100,
        serving_unit: customFoodForm.serving_unit,
        calories: Number(customFoodForm.calories) || 0,
        protein: Number(customFoodForm.protein) || 0,
        carbs: Number(customFoodForm.carbs) || 0,
        fat: Number(customFoodForm.fat) || 0,
        fiber: Number(customFoodForm.fiber) || 0,
      });

      if (customFoodForm.aliases.trim()) {
        const aliasList = customFoodForm.aliases
          .split(',')
          .map((a) => a.trim())
          .filter((a) => a.length > 0);

        for (const alias of aliasList) {
          const { error: aliasError } = await supabase.from('food_aliases').insert({
            food_id: created.id,
            alias: alias,
          });
          if (aliasError) {
            console.warn('Failed to insert alias:', alias, aliasError);
          }
        }
      }

      toast({
        title: 'Custom Food Saved',
        description: `"${customFoodForm.name}" has been added to your foods.`,
      });
      setIsCustomDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error saving food',
        description: err instanceof Error ? err.message : 'Please check details.',
        variant: 'destructive',
      });
    }
  };

  const openSaveAsCustomFood = () => {
    // Manual's fields hold totals for the entered portion, but custom foods
    // are stored per-100g (matching how every other food in indian_foods
    // works) -- normalize before prefilling, or a >100g portion gets saved
    // that many times too rich.
    const weight = Number(portionWeight) || 100;
    const ratio = 100 / weight;
    setCustomFoodForm({
      name: mealData.name,
      category: 'south_indian',
      serving_size: portionWeight || '100',
      serving_unit: 'g',
      calories: String(Math.round((Number(mealData.calories) || 0) * ratio)),
      protein: String(Math.round((Number(mealData.protein) || 0) * ratio * 10) / 10),
      carbs: String(Math.round((Number(mealData.carbs) || 0) * ratio * 10) / 10),
      fat: String(Math.round((Number(mealData.fat) || 0) * ratio * 10) / 10),
      fiber: String(Math.round((Number(mealData.fiber) || 0) * ratio * 10) / 10),
      aliases: '',
    });
    setAliasDraft('');
    setIsCustomDialogOpen(true);
  };

  const commitAliasDraft = () => {
    const val = aliasDraft.trim();
    if (!val) return;
    setCustomFoodForm((prev) => ({
      ...prev,
      aliases: [...aliasChips, val].join(', '),
    }));
    setAliasDraft('');
  };

  const removeAliasChip = (idx: number) => {
    setCustomFoodForm((prev) => ({
      ...prev,
      aliases: aliasChips.filter((_, i) => i !== idx).join(', '),
    }));
  };

  const [baseNutrition, setBaseNutrition] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    vitaminC: number;
    vitaminD: number;
    vitaminB12: number;
    iron: number;
    calcium: number;
    potassium: number;
    sodium: number;
    magnesium: number;
    zinc: number;
    servingSizeWeight: number;
  } | null>(null);
  const [portionWeight, setPortionWeight] = useState<string>('100');

  const getDefaultMealTime = () => {
    const hour = new Date().getHours();
    if (hour < 11) return 'breakfast';
    if (hour < 16) return 'lunch';
    if (hour < 20) return 'dinner';
    return 'snack';
  };

  const [mealData, setMealData] = useState({
    name: '',
    mealTime: getDefaultMealTime(),
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    vitaminC: '',
    vitaminD: '',
    vitaminB12: '',
    iron: '',
    calcium: '',
    potassium: '',
    sodium: '',
    magnesium: '',
    zinc: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handlePortionWeightChange = (newWeightStr: string) => {
    setPortionWeight(newWeightStr);
    const newWeight = parseFloat(newWeightStr);

    if (baseNutrition && !isNaN(newWeight) && newWeight > 0) {
      const ratio = newWeight / baseNutrition.servingSizeWeight;
      const scale = (n: number) => String(Math.round(n * ratio * 10) / 10);
      setMealData((prev) => ({
        ...prev,
        calories: String(Math.round(baseNutrition.calories * ratio)),
        protein: scale(baseNutrition.protein),
        carbs: scale(baseNutrition.carbs),
        fat: scale(baseNutrition.fat),
        fiber: scale(baseNutrition.fiber),
        vitaminC: scale(baseNutrition.vitaminC),
        vitaminD: scale(baseNutrition.vitaminD),
        vitaminB12: scale(baseNutrition.vitaminB12),
        iron: scale(baseNutrition.iron),
        calcium: scale(baseNutrition.calcium),
        potassium: scale(baseNutrition.potassium),
        sodium: scale(baseNutrition.sodium),
        magnesium: scale(baseNutrition.magnesium),
        zinc: scale(baseNutrition.zinc),
      }));
    }
  };

  const updateBaseNutritionFromForm = (field: string, value: string) => {
    const numVal = parseFloat(value) || 0;
    const currentWeight = parseFloat(portionWeight) || 100;

    setBaseNutrition((prev) => {
      const currentBase = prev || {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        servingSizeWeight: 100,
      };

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
        if (weightMatch) {
          const val = parseFloat(weightMatch[1]);
          const unit = weightMatch[2].toLowerCase();
          parsedWeight = unit.startsWith('oz') ? Math.round(val * 28.35) : val;
        }

        setBaseNutrition({
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          fiber: data.fiber,
          vitaminC: data.vitaminC ?? 0,
          vitaminD: data.vitaminD ?? 0,
          vitaminB12: data.vitaminB12 ?? 0,
          iron: data.iron ?? 0,
          calcium: data.calcium ?? 0,
          potassium: data.potassium ?? 0,
          sodium: data.sodium ?? 0,
          magnesium: data.magnesium ?? 0,
          zinc: data.zinc ?? 0,
          servingSizeWeight: parsedWeight,
        });
        setPortionWeight(String(parsedWeight));

        setMealData({
          ...mealData,
          name: data.name,
          calories: String(data.calories),
          protein: String(data.protein),
          carbs: String(data.carbs),
          fat: String(data.fat),
          fiber: String(data.fiber),
          vitaminC: String(data.vitaminC ?? 0),
          vitaminD: String(data.vitaminD ?? 0),
          vitaminB12: String(data.vitaminB12 ?? 0),
          iron: String(data.iron ?? 0),
          calcium: String(data.calcium ?? 0),
          potassium: String(data.potassium ?? 0),
          sodium: String(data.sodium ?? 0),
          magnesium: String(data.magnesium ?? 0),
          zinc: String(data.zinc ?? 0),
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
      const { error } = await supabase.from('daily_meals').insert({
        user_id: user.id,
        name: mealData.name,
        calories: Number(mealData.calories),
        protein: Number(mealData.protein) || 0,
        carbs: Number(mealData.carbs) || 0,
        fat: Number(mealData.fat) || 0,
        fiber: Number(mealData.fiber) || 0,
        vitamin_c: Number(mealData.vitaminC) || 0,
        vitamin_d: Number(mealData.vitaminD) || 0,
        vitamin_b12: Number(mealData.vitaminB12) || 0,
        iron: Number(mealData.iron) || 0,
        calcium: Number(mealData.calcium) || 0,
        potassium: Number(mealData.potassium) || 0,
        sodium: Number(mealData.sodium) || 0,
        magnesium: Number(mealData.magnesium) || 0,
        zinc: Number(mealData.zinc) || 0,
        meal_time: mealData.mealTime,
        logged_date: mealData.date,
      });

      if (error) throw error;

      toast({
        title: 'Meal added',
        description: `"${mealData.name}" has been added to your daily log.`,
      });

      setMealData({
        name: '',
        mealTime: getDefaultMealTime(),
        calories: '',
        protein: '',
        carbs: '',
        fat: '',
        fiber: '',
        vitaminC: '',
        vitaminD: '',
        vitaminB12: '',
        iron: '',
        calcium: '',
        potassium: '',
        sodium: '',
        magnesium: '',
        zinc: '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });
      setBaseNutrition(null);

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
      {/* Meal slot chips */}
      <div className="flex gap-2 mb-6">
          {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((slot) => {
            const isActive = mealData.mealTime === slot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => setMealData({ ...mealData, mealTime: slot })}
                className={
                  isActive
                    ? 'rounded-full px-[13px] py-2 text-xs font-medium bg-primary/16 border border-primary/34 text-primary'
                    : 'rounded-full px-[13px] py-2 text-xs font-medium bg-muted border border-border text-muted-foreground'
                }
              >
                {slot.charAt(0).toUpperCase() + slot.slice(1)}
              </button>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="chat" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 px-1.5 text-[11px] sm:text-sm">
              <Edit3 className="w-3.5 h-3.5" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat">
            <ChatMealLog defaultMealTime={mealData.mealTime} />
          </TabsContent>

          <TabsContent value="manual">
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
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Meal name
                  </span>
                  <input
                    id="name"
                    value={mealData.name}
                    onChange={(e) => setMealData({ ...mealData, name: e.target.value })}
                    placeholder="e.g., 150g Chicken Breast"
                    className="block w-full bg-transparent text-lg font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
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
                    <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
                      <span className="flex-none text-xs text-muted-foreground">g</span>
                    </div>
                    {baseNutrition && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Base serving: {baseNutrition.servingSizeWeight}g
                      </p>
                    )}
                  </div>

                  <div
                    className={`space-y-2 rounded-2xl border p-3.5 ${
                      mealData.calories ? 'border-primary/25 bg-primary/[0.07]' : 'border-border bg-muted/60'
                    }`}
                  >
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
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
                    {Number(mealData.calories) > 0 && (
                      <p className="font-mono text-[10px] text-primary/60">
                        {((Number(mealData.calories) / (Number(portionWeight) || 100)) * 100).toFixed(1)} per 100g
                      </p>
                    )}
                  </div>
                </div>

                {/* Macronutrients */}
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
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

                {/* Hidden Date Field */}
                <input
                  type="hidden"
                  value={mealData.date}
                  onChange={(e) =>
                    setMealData({ ...mealData, date: e.target.value })
                  }
                />

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
                      Add to {mealData.mealTime.charAt(0).toUpperCase() + mealData.mealTime.slice(1)}
                      <span className="h-4 w-px bg-primary-foreground/30" />
                      <span className="font-mono tabular-nums">{mealData.calories} kcal</span>
                    </>
                  ) : (
                    'Add meal'
                  )}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>

      {/* Save as Custom Food Dialog */}
      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto rounded-xl border-border bg-card p-5 text-foreground">
          <form onSubmit={handleCreateCustomFood} className="space-y-4">
            <DialogHeader className="space-y-1.5 pr-6 text-left">
              <DialogTitle className="font-display text-lg">Save as food</DialogTitle>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Every field is editable. Prefilled from the meal you just entered — name, portion and the four macros.
              </p>
            </DialogHeader>

            <div className="space-y-1.5">
              <Label htmlFor="custom-name" className="text-[10px] uppercase tracking-wide text-muted-foreground">Food Name</Label>
              <Input
                id="custom-name"
                value={customFoodForm.name}
                onChange={(e) => setCustomFoodForm({ ...customFoodForm, name: e.target.value })}
                placeholder="e.g. Homemade Chicken Curry"
                className="h-[42px] rounded-[11px] bg-background/60 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="custom-category" className="text-[10px] uppercase tracking-wide text-muted-foreground">Category</Label>
                <Select
                  value={customFoodForm.category}
                  onValueChange={(val) => setCustomFoodForm({ ...customFoodForm, category: val })}
                >
                  <SelectTrigger className="h-[42px] rounded-[11px] bg-background/60 text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom-serving" className="text-[10px] uppercase tracking-wide text-muted-foreground">Portion Size</Label>
                <div className="flex h-[42px] items-center gap-1.5 rounded-[11px] border border-input bg-background/60 px-3">
                  <input
                    id="custom-serving"
                    type="number"
                    value={customFoodForm.serving_size}
                    onChange={(e) => setCustomFoodForm({ ...customFoodForm, serving_size: e.target.value })}
                    placeholder="100"
                    className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-foreground focus:outline-none"
                    required
                  />
                  <span className="flex-none text-[11px] text-muted-foreground">g</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="custom-unit" className="text-[10px] uppercase tracking-wide text-muted-foreground">Serving Unit</Label>
                <Input
                  id="custom-unit"
                  value={customFoodForm.serving_unit}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, serving_unit: e.target.value })}
                  placeholder="piece, glass, g, ml"
                  className="h-[42px] rounded-[11px] bg-background/60 text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom-calories" className="text-[10px] uppercase tracking-wide text-muted-foreground">Calories per 100g</Label>
                <div className="flex h-[42px] items-center gap-1.5 rounded-[11px] border border-input bg-background/60 px-3">
                  <input
                    id="custom-calories"
                    type="number"
                    value={customFoodForm.calories}
                    onChange={(e) => setCustomFoodForm({ ...customFoodForm, calories: e.target.value })}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-foreground focus:outline-none"
                    required
                  />
                  <span className="flex-none text-[11px] text-muted-foreground">kcal</span>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="custom-protein" className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-chart-protein">
                  <span className="h-1.5 w-1.5 rounded-full bg-chart-protein" />
                  Protein / 100g
                </Label>
                <div className="flex h-[42px] items-center gap-1.5 rounded-[11px] border border-input bg-background/60 px-3">
                  <input
                    id="custom-protein"
                    type="number"
                    step="0.1"
                    value={customFoodForm.protein}
                    onChange={(e) => setCustomFoodForm({ ...customFoodForm, protein: e.target.value })}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-foreground focus:outline-none"
                    required
                  />
                  <span className="flex-none text-[11px] text-muted-foreground">g</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom-carbs" className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-chart-carbs">
                  <span className="h-1.5 w-1.5 rounded-full bg-chart-carbs" />
                  Carbs / 100g
                </Label>
                <div className="flex h-[42px] items-center gap-1.5 rounded-[11px] border border-input bg-background/60 px-3">
                  <input
                    id="custom-carbs"
                    type="number"
                    step="0.1"
                    value={customFoodForm.carbs}
                    onChange={(e) => setCustomFoodForm({ ...customFoodForm, carbs: e.target.value })}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-foreground focus:outline-none"
                    required
                  />
                  <span className="flex-none text-[11px] text-muted-foreground">g</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label htmlFor="custom-fat" className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-chart-fat">
                  <span className="h-1.5 w-1.5 rounded-full bg-chart-fat" />
                  Fat / 100g
                </Label>
                <div className="flex h-[42px] items-center gap-1.5 rounded-[11px] border border-input bg-background/60 px-3">
                  <input
                    id="custom-fat"
                    type="number"
                    step="0.1"
                    value={customFoodForm.fat}
                    onChange={(e) => setCustomFoodForm({ ...customFoodForm, fat: e.target.value })}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-foreground focus:outline-none"
                    required
                  />
                  <span className="flex-none text-[11px] text-muted-foreground">g</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="custom-fiber" className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-chart-fiber">
                  <span className="h-1.5 w-1.5 rounded-full bg-chart-fiber" />
                  Fiber / 100g
                </Label>
                <div className="flex h-[42px] items-center gap-1.5 rounded-[11px] border border-input bg-background/60 px-3">
                  <input
                    id="custom-fiber"
                    type="number"
                    step="0.1"
                    value={customFoodForm.fiber}
                    onChange={(e) => setCustomFoodForm({ ...customFoodForm, fiber: e.target.value })}
                    placeholder="0"
                    className="w-full min-w-0 bg-transparent font-mono text-sm tabular-nums text-foreground focus:outline-none"
                  />
                  <span className="flex-none text-[11px] text-muted-foreground">g</span>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="custom-alias-draft" className="text-[10px] uppercase tracking-wide text-muted-foreground">Aliases</Label>
                <span className="text-[10px] text-muted-foreground">optional</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 rounded-[11px] border border-input bg-background/60 p-2">
                {aliasChips.map((chip, i) => (
                  <span
                    key={`${chip}-${i}`}
                    className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground"
                  >
                    {chip}
                    <button type="button" onClick={() => removeAliasChip(i)} aria-label={`Remove ${chip}`}>
                      <X className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                  </span>
                ))}
                <input
                  id="custom-alias-draft"
                  value={aliasDraft}
                  onChange={(e) => setAliasDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === ',' || e.key === 'Enter') {
                      e.preventDefault();
                      commitAliasDraft();
                    }
                  }}
                  onBlur={commitAliasDraft}
                  placeholder="Type and press comma"
                  className="min-w-[110px] flex-1 bg-transparent px-1 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            <DialogFooter className="flex-row gap-2.5 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCustomDialogOpen(false)}
                className="h-[52px] w-[106px] flex-none rounded-[14px]"
              >
                Cancel
              </Button>
              <Button type="submit" className="h-[52px] flex-1 rounded-[14px]">
                Save Food
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddMeal;
