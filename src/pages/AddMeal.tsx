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
          try {
            await supabase.from('food_aliases').insert({
              food_id: created.id,
              alias: alias,
            });
          } catch (err) {
            console.warn('Failed to insert alias:', alias, err);
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
    setCustomFoodForm({
      name: mealData.name,
      category: 'south_indian',
      serving_size: portionWeight || '100',
      serving_unit: 'g',
      calories: mealData.calories,
      protein: mealData.protein,
      carbs: mealData.carbs,
      fat: mealData.fat,
      fiber: mealData.fiber,
      aliases: '',
    });
    setIsCustomDialogOpen(true);
  };

  const [baseNutrition, setBaseNutrition] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
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
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handlePortionWeightChange = (newWeightStr: string) => {
    setPortionWeight(newWeightStr);
    const newWeight = parseFloat(newWeightStr);

    if (baseNutrition && !isNaN(newWeight) && newWeight > 0) {
      const ratio = newWeight / baseNutrition.servingSizeWeight;
      setMealData((prev) => ({
        ...prev,
        calories: String(Math.round(baseNutrition.calories * ratio)),
        protein: String(Math.round(baseNutrition.protein * ratio * 10) / 10),
        carbs: String(Math.round(baseNutrition.carbs * ratio * 10) / 10),
        fat: String(Math.round(baseNutrition.fat * ratio * 10) / 10),
        fiber: String(Math.round(baseNutrition.fiber * ratio * 10) / 10),
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
        date: new Date().toISOString().split('T')[0],
        notes: '',
      });

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
            <div className="elevation-card p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Meal Name */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="name" className="text-foreground text-base">
                      Meal Name
                    </Label>
                    {mealData.name.trim().length >= 3 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAutoFill}
                        disabled={autoFilling}
                        className="text-primary hover:text-primary/80 text-xs flex items-center gap-1 h-auto p-1 font-normal"
                      >
                        {autoFilling ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Calculating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>Auto-fill Macros</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <Input
                    id="name"
                    value={mealData.name}
                    onChange={(e) =>
                      setMealData({ ...mealData, name: e.target.value })
                    }
                    placeholder="e.g., 150g Chicken Breast"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base backdrop-blur-sm"
                    required
                  />
                </div>

                {/* Portion Weight */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="portionWeight" className="text-foreground text-base">
                      Portion Weight (g)
                    </Label>
                    {baseNutrition && (
                      <span className="text-xs text-muted-foreground">
                        Base serving: {baseNutrition.servingSizeWeight}g
                      </span>
                    )}
                  </div>
                  <Input
                    id="portionWeight"
                    type="number"
                    value={portionWeight}
                    onChange={(e) => handlePortionWeightChange(e.target.value)}
                    placeholder="e.g., 100"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base font-mono tabular-nums backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                  />
                </div>

                {/* Calories */}
                <div className="space-y-2">
                  <Label
                    htmlFor="calories"
                    className="text-foreground text-base"
                  >
                    Calories
                  </Label>
                  <Input
                    id="calories"
                    type="number"
                    value={mealData.calories}
                    onChange={(e) => {
                      setMealData({ ...mealData, calories: e.target.value });
                      updateBaseNutritionFromForm('calories', e.target.value);
                    }}
                    placeholder="Enter total calories"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base font-mono tabular-nums backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                    required
                  />
                </div>

                {/* Macronutrients */}
                <div className="space-y-4">
                  <h3 className="text-foreground text-base font-medium">
                    Macronutrients
                  </h3>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="protein"
                        className="text-chart-protein text-sm"
                      >
                        Protein (g)
                      </Label>
                      <Input
                        id="protein"
                        type="number"
                        step="0.1"
                        value={mealData.protein}
                        onChange={(e) => {
                          setMealData({ ...mealData, protein: e.target.value });
                          updateBaseNutritionFromForm('protein', e.target.value);
                        }}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 font-mono tabular-nums backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="carbs"
                        className="text-chart-carbs text-sm"
                      >
                        Carbs (g)
                      </Label>
                      <Input
                        id="carbs"
                        type="number"
                        step="0.1"
                        value={mealData.carbs}
                        onChange={(e) => {
                          setMealData({ ...mealData, carbs: e.target.value });
                          updateBaseNutritionFromForm('carbs', e.target.value);
                        }}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 font-mono tabular-nums backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                      />
                    </div>
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="fat"
                        className="text-chart-fat text-sm"
                      >
                        Fats (g)
                      </Label>
                      <Input
                        id="fat"
                        type="number"
                        step="0.1"
                        value={mealData.fat}
                        onChange={(e) => {
                          setMealData({ ...mealData, fat: e.target.value });
                          updateBaseNutritionFromForm('fat', e.target.value);
                        }}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 font-mono tabular-nums backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="fiber"
                        className="text-chart-fiber text-sm"
                      >
                        Fiber (g)
                      </Label>
                      <Input
                        id="fiber"
                        type="number"
                        step="0.1"
                        value={mealData.fiber}
                        onChange={(e) => {
                          setMealData({ ...mealData, fiber: e.target.value });
                          updateBaseNutritionFromForm('fiber', e.target.value);
                        }}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 font-mono tabular-nums backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                      />
                    </div>
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

                {/* Save as reusable food */}
                {mealData.name.trim().length >= 3 && mealData.calories && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openSaveAsCustomFood}
                    className="w-full h-11 border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 rounded-xl gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Save as reusable food
                  </Button>
                )}

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    className="w-full h-14 text-lg font-medium rounded-xl"
                    disabled={loading}
                  >
                    {loading ? 'Adding...' : 'Add Meal'}
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
        </Tabs>

      {/* Save as Custom Food Dialog */}
      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Save as Reusable Food</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomFood} className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="custom-name" className="text-xs">Food Name</Label>
              <Input
                id="custom-name"
                value={customFoodForm.name}
                onChange={(e) => setCustomFoodForm({ ...customFoodForm, name: e.target.value })}
                placeholder="e.g. Homemade Chicken Curry"
                className="h-10 text-sm bg-background/40"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="custom-category" className="text-xs">Category</Label>
                <Select
                  value={customFoodForm.category}
                  onValueChange={(val) => setCustomFoodForm({ ...customFoodForm, category: val })}
                >
                  <SelectTrigger className="h-10 text-sm bg-background/40">
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

              <div className="space-y-1">
                <Label htmlFor="custom-serving" className="text-xs">Portion Size</Label>
                <Input
                  id="custom-serving"
                  type="number"
                  value={customFoodForm.serving_size}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, serving_size: e.target.value })}
                  placeholder="100"
                  className="h-10 text-sm bg-background/40 font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="custom-unit" className="text-xs">Serving Unit</Label>
                <Input
                  id="custom-unit"
                  value={customFoodForm.serving_unit}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, serving_unit: e.target.value })}
                  placeholder="piece, glass, g, ml"
                  className="h-10 text-sm bg-background/40"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="custom-calories" className="text-xs">Calories per 100g</Label>
                <Input
                  id="custom-calories"
                  type="number"
                  value={customFoodForm.calories}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, calories: e.target.value })}
                  placeholder="kcal"
                  className="h-10 text-sm bg-background/40 font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border/10 pt-2">
              <div className="space-y-1">
                <Label htmlFor="custom-protein" className="text-xs text-chart-protein">Protein (g) / 100g</Label>
                <Input
                  id="custom-protein"
                  type="number"
                  step="0.1"
                  value={customFoodForm.protein}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, protein: e.target.value })}
                  placeholder="g"
                  className="h-10 text-sm bg-background/40 font-mono tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="custom-carbs" className="text-xs text-chart-carbs">Carbs (g) / 100g</Label>
                <Input
                  id="custom-carbs"
                  type="number"
                  step="0.1"
                  value={customFoodForm.carbs}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, carbs: e.target.value })}
                  placeholder="g"
                  className="h-10 text-sm bg-background/40 font-mono tabular-nums"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="custom-fat" className="text-xs text-chart-fat">Fat (g) / 100g</Label>
                <Input
                  id="custom-fat"
                  type="number"
                  step="0.1"
                  value={customFoodForm.fat}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, fat: e.target.value })}
                  placeholder="g"
                  className="h-10 text-sm bg-background/40 font-mono tabular-nums"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="custom-fiber" className="text-xs text-chart-fiber">Fiber (g) / 100g</Label>
                <Input
                  id="custom-fiber"
                  type="number"
                  step="0.1"
                  value={customFoodForm.fiber}
                  onChange={(e) => setCustomFoodForm({ ...customFoodForm, fiber: e.target.value })}
                  placeholder="g"
                  className="h-10 text-sm bg-background/40 font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="custom-aliases" className="text-xs">Aliases (Comma separated)</Label>
              <Input
                id="custom-aliases"
                value={customFoodForm.aliases}
                onChange={(e) => setCustomFoodForm({ ...customFoodForm, aliases: e.target.value })}
                placeholder="e.g. Chapathi, Roti, Phulka"
                className="h-10 text-sm bg-background/40"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 flex-row justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCustomDialogOpen(false)}
                className="h-10"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-10"
              >
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
