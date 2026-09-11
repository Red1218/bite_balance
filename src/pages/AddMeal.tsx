import { useState, useEffect, useCallback } from 'react';
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
  ChevronLeft,
  Search,
  Edit3,
  ScanBarcode,
  Sparkles,
  Loader2,
  Plus,
  Clock,
  Trash2,
  CheckCircle,
  Flame
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FoodSearch } from '@/components/FoodSearch';
import BarcodeScanner from '@/components/BarcodeScanner';
import { 
  searchFoodsDb, 
  createCustomFood, 
  updateCustomFood, 
  deleteCustomFood,
  IndianFood
} from '@/services/foodService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import ChatMealLog from '@/components/ChatMealLog';

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

const popularFoods = [
  { id: '11111111-1111-1111-1111-111111111111', name: 'Idli', category: 'south_indian', serving_size: 50, serving_unit: 'piece', calories: 120, protein: 3.2, carbs: 24.8, fat: 0.4, fiber: 1.6, is_verified: true },
  { id: '22222222-2222-2222-2222-222222222222', name: 'Plain Dosa', category: 'south_indian', serving_size: 80, serving_unit: 'piece', calories: 169, protein: 3.5, carbs: 30.3, fat: 3.5, fiber: 1.4, is_verified: true },
  { id: '33333333-3333-3333-3333-333333333333', name: 'Masala Dosa', category: 'south_indian', serving_size: 150, serving_unit: 'piece', calories: 193, protein: 3.2, carbs: 32.3, fat: 5.7, fiber: 1.7, is_verified: true },
  { id: '88888888-8888-8888-8888-888888888888', name: 'Chapati (Roti)', category: 'north_indian', serving_size: 30, serving_unit: 'piece', calories: 267, protein: 9.3, carbs: 55.0, fat: 1.3, fiber: 7.7, is_verified: true },
  { id: '66666666-6666-6666-6666-666666666666', name: 'White Rice', category: 'rice_grains', serving_size: 100, serving_unit: 'g', calories: 130, protein: 2.7, carbs: 28.0, fat: 0.3, fiber: 0.4, is_verified: true },
  { id: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', name: 'Paneer Butter Masala', category: 'dairy', serving_size: 100, serving_unit: 'g', calories: 229, protein: 7.8, carbs: 6.2, fat: 19.5, fiber: 0.8, is_verified: true },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Dal Tadka', category: 'curries', serving_size: 100, serving_unit: 'g', calories: 110, protein: 5.2, carbs: 15.4, fat: 3.5, fiber: 4.2, is_verified: true },
  { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Sambar', category: 'curries', serving_size: 100, serving_unit: 'g', calories: 62, protein: 2.1, carbs: 8.4, fat: 2.2, fiber: 2.1, is_verified: true },
  { id: '14141414-1414-1414-1414-141414141414', name: 'Boiled Egg', category: 'eggs', serving_size: 50, serving_unit: 'piece', calories: 155, protein: 13.0, carbs: 1.1, fat: 11.0, fiber: 0.0, is_verified: true },
  { id: '15151515-1515-1515-1515-151515151515', name: 'Banana', category: 'fruits', serving_size: 120, serving_unit: 'piece', calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, is_verified: true },
  { id: '16161616-1616-1616-1616-161616161616', name: 'Apple', category: 'fruits', serving_size: 180, serving_unit: 'piece', calories: 52, protein: 0.3, carbs: 14.0, fat: 0.2, fiber: 2.4, is_verified: true },
];

const AddMeal = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [autoFilling, setAutoFilling] = useState(false);
  
  const [indianCategory, setIndianCategory] = useState('south_indian');
  const [indianSearchQuery, setIndianSearchQuery] = useState('');
  const [categoryFoods, setCategoryFoods] = useState<IndianFood[]>([]);
  const [loadingFoods, setLoadingFoods] = useState(false);
  
  const [recentSearches, setRecentSearches] = useState<IndianFood[]>([]);
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [editingCustomId, setEditingCustomId] = useState<string | null>(null);
  
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

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const recent = localStorage.getItem('recent_searches');
      if (recent) {
        setRecentSearches(JSON.parse(recent));
      }
    } catch (err) {
      console.warn('Failed to load recent searches:', err);
    }
  }, []);

  const saveToRecentSearches = (food: IndianFood) => {
    try {
      const recent = localStorage.getItem('recent_searches');
      let list = recent ? JSON.parse(recent) : [];
      list = list.filter((item: IndianFood) => item.id !== food.id);
      list.unshift(food);
      list = list.slice(0, 8); // Keep last 8 searches
      localStorage.setItem('recent_searches', JSON.stringify(list));
      setRecentSearches(list);
    } catch (err) {
      console.warn('Failed to save recent search:', err);
    }
  };

  const clearRecentSearches = () => {
    localStorage.removeItem('recent_searches');
    setRecentSearches([]);
  };

  const resetCustomFoodForm = () => {
    setCustomFoodForm({
      name: '',
      category: indianCategory || 'south_indian',
      serving_size: '100',
      serving_unit: 'g',
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      fiber: '',
      aliases: '',
    });
    setIsEditingCustom(false);
    setEditingCustomId(null);
  };

  const handleCreateOrUpdateCustomFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to manage custom foods',
        variant: 'destructive',
      });
      return;
    }

    try {
      const payload = {
        name: customFoodForm.name,
        category: customFoodForm.category,
        serving_size: Number(customFoodForm.serving_size) || 100,
        serving_unit: customFoodForm.serving_unit,
        calories: Number(customFoodForm.calories) || 0,
        protein: Number(customFoodForm.protein) || 0,
        carbs: Number(customFoodForm.carbs) || 0,
        fat: Number(customFoodForm.fat) || 0,
        fiber: Number(customFoodForm.fiber) || 0,
      };

      let foodId = '';

      if (isEditingCustom && editingCustomId) {
        const updated = await updateCustomFood(editingCustomId, payload);
        foodId = updated.id;
        toast({
          title: 'Custom Food Updated',
          description: `"${customFoodForm.name}" has been updated.`,
        });
      } else {
        const created = await createCustomFood(payload);
        foodId = created.id;

        // Insert aliases if provided
        if (customFoodForm.aliases.trim()) {
          const aliasList = customFoodForm.aliases
            .split(',')
            .map((a) => a.trim())
            .filter((a) => a.length > 0);

          for (const alias of aliasList) {
            try {
              await supabase.from('food_aliases').insert({
                food_id: foodId,
                alias: alias,
              });
            } catch (err) {
              console.warn('Failed to insert alias:', alias, err);
            }
          }
        }

        toast({
          title: 'Custom Food Created',
          description: `"${customFoodForm.name}" has been added.`,
        });
      }

      setIsCustomDialogOpen(false);
      resetCustomFoodForm();
      fetchCategoryOrSearchFoods();
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error saving food',
        description: err instanceof Error ? err.message : 'Please check details.',
        variant: 'destructive',
      });
    }
  };

  const handleEditClick = (e: React.MouseEvent, food: IndianFood) => {
    e.stopPropagation(); // prevent selecting the food for logging
    setIsEditingCustom(true);
    setEditingCustomId(food.id);
    setCustomFoodForm({
      name: food.name,
      category: food.category,
      serving_size: String(food.serving_size || 100),
      serving_unit: food.serving_unit || 'g',
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
      fiber: String(food.fiber || 0),
      aliases: '',
    });
    setIsCustomDialogOpen(true);
  };

  const handleDeleteClick = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation(); // prevent selection
    if (window.confirm(`Are you sure you want to delete custom food "${name}"?`)) {
      try {
        await deleteCustomFood(id);
        toast({
          title: 'Deleted',
          description: `Custom food "${name}" has been deleted.`,
        });
        fetchCategoryOrSearchFoods();
      } catch (err) {
        console.error(err);
        toast({
          title: 'Error',
          description: 'Failed to delete custom food',
          variant: 'destructive',
        });
      }
    }
  };

  const fetchCategoryOrSearchFoods = useCallback(async () => {
    setLoadingFoods(true);
    try {
      if (indianSearchQuery.trim().length >= 2) {
        const results = await searchFoodsDb(indianSearchQuery);
        setCategoryFoods(results);
      } else {
        const { data, error } = await supabase
          .from('indian_foods')
          .select('*')
          .eq('category', indianCategory)
          .or(`user_id.is.null,user_id.eq.${user?.id || '00000000-0000-0000-0000-000000000000'}`)
          .order('is_verified', { ascending: false })
          .order('name', { ascending: true });

        if (!error && data) {
          setCategoryFoods(data as unknown as IndianFood[]);
        } else {
          setCategoryFoods([]);
        }
      }
    } catch (err) {
      console.error('Failed to load foods:', err);
    } finally {
      setLoadingFoods(false);
    }
  }, [indianCategory, indianSearchQuery, user?.id]);

  useEffect(() => {
    fetchCategoryOrSearchFoods();
  }, [fetchCategoryOrSearchFoods]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchCategoryOrSearchFoods();
    }, 350);

    return () => clearTimeout(delayDebounce);
  }, [indianSearchQuery, fetchCategoryOrSearchFoods]);

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

  const parseServingWeight = (servingSize: string): number => {
    if (!servingSize) return 100;
    const parenMatch = servingSize.match(/\((\d+(?:\.\d+)?)\s*g/i);
    if (parenMatch) return parseFloat(parenMatch[1]);
    const directMatch = servingSize.match(/(\d+(?:\.\d+)?)\s*g/i);
    if (directMatch) return parseFloat(directMatch[1]);
    return 100;
  };

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

  const handleFoodSelect = (food: IndianFood) => {
    // Determine default portion weight in grams
    let defaultWeight = 100;
    if (typeof food.serving_size === 'number') {
      defaultWeight = food.serving_size;
    } else if (typeof food.serving_size === 'string') {
      defaultWeight = parseServingWeight(food.serving_size);
    }

    setBaseNutrition({
      calories: Number(food.calories),
      protein: Number(food.protein),
      carbs: Number(food.carbs),
      fat: Number(food.fat),
      fiber: Number(food.fiber) || 0,
      servingSizeWeight: 100, // Normalized base is 100g
    });
    
    setPortionWeight(String(defaultWeight));

    const ratio = defaultWeight / 100;
    setMealData({
      ...mealData,
      name: food.is_verified ? food.name : `${food.name} (Custom)`,
      calories: String(Math.round(Number(food.calories) * ratio)),
      protein: String(Math.round(Number(food.protein) * ratio * 10) / 10),
      carbs: String(Math.round(Number(food.carbs) * ratio * 10) / 10),
      fat: String(Math.round(Number(food.fat) * ratio * 10) / 10),
      fiber: String(Math.round((Number(food.fiber) || 0) * ratio * 10) / 10),
    });

    setActiveTab('manual');
    toast({
      title: 'Food Selected',
      description: `Loaded nutrition facts for ${food.name}. Review values to save.`,
    });

    saveToRecentSearches(food);
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

      navigate('/');
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
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl bg-card border border-border text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-xl font-display font-semibold text-foreground flex-1">Add meal</h1>
        </div>

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
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="search" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Search className="w-3.5 h-3.5" />
              Search
            </TabsTrigger>
            <TabsTrigger value="indian" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5 text-chart-carbs" />
              Indian
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Sparkles className="w-3.5 h-3.5" />
              AI Log
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-1.5 px-2 text-xs sm:text-sm">
              <Edit3 className="w-3.5 h-3.5" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="elevation-card p-6">
              <p className="text-sm text-muted-foreground mb-4">
                Search for foods to auto-fill nutritional information
              </p>
              <div className="flex flex-col gap-4">
                <FoodSearch onSelect={handleFoodSelect} />

                <div className="flex items-center justify-center pt-2 relative">
                  <div className="absolute w-full h-[1px] bg-border/40" />
                  <span className="text-xs text-muted-foreground bg-card px-2 z-10">OR</span>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsScannerOpen(true)}
                  className="w-full h-12 border-primary/30 bg-primary/10 text-primary hover:bg-primary/15 rounded-xl gap-2 mt-2"
                >
                  <ScanBarcode className="w-5 h-5" />
                  Scan Barcode
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="indian" className="space-y-4">
            <div className="elevation-card p-4 sm:p-6 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-display font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                    Indian Cuisine Database
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Search standard dishes & manage custom foods
                  </p>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    resetCustomFoodForm();
                    setIsCustomDialogOpen(true);
                  }}
                  className="rounded-lg text-xs h-8 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Custom
                </Button>
              </div>

              {/* Search input with debounced querying */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search foods or aliases (e.g. roti, dosa, curry)..."
                  value={indianSearchQuery}
                  onChange={(e) => setIndianSearchQuery(e.target.value)}
                  className="pl-9 h-10 text-xs bg-background/50 border-border focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:border-primary/50"
                />
              </div>

              {/* Display browse view if query is short */}
              {indianSearchQuery.trim().length < 2 ? (
                <div className="space-y-4">
                  {/* Recent Searches */}
                  {recentSearches.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 text-primary/80" />
                          Recent Logs
                        </h3>
                        <button
                          type="button"
                          onClick={clearRecentSearches}
                          className="text-[10px] text-primary/80 hover:text-primary hover:underline"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSearches.map((food) => (
                          <button
                            key={`recent-${food.id}`}
                            type="button"
                            onClick={() => handleFoodSelect(food)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-accent/20 hover:bg-accent/40 border border-border/30 rounded-full text-[10px] text-foreground transition-all"
                          >
                            <span>{food.name}</span>
                            {food.is_verified && <CheckCircle className="w-2.5 h-2.5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Foods Quick Section */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                      <Flame className="w-3 h-3 text-chart-carbs" />
                      Popular Foods
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {popularFoods.map((food) => (
                        <button
                          key={`pop-${food.id}`}
                          type="button"
                          onClick={() => handleFoodSelect(food)}
                          className="flex items-center gap-1 px-3 py-1 bg-primary/5 hover:bg-primary/10 border border-primary/20 hover:border-primary/40 rounded-full text-[10px] text-foreground transition-all"
                        >
                          <span>{food.name}</span>
                          <span className="text-[8px] text-muted-foreground">({food.serving_size}{food.serving_unit === 'g' ? 'g' : ` ${food.serving_unit}`})</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Categories Horizontal Scroll */}
                  <div className="space-y-2 pt-2 border-t border-border/10">
                    <h3 className="text-xs font-semibold text-muted-foreground">
                      Browse Categories
                    </h3>
                    <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-none -mx-2 px-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setIndianCategory(cat.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-medium whitespace-nowrap transition-all ${
                            indianCategory === cat.id
                              ? 'bg-primary border-primary text-primary-foreground shadow-sm font-semibold'
                              : 'bg-background hover:bg-accent border-border text-muted-foreground'
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Foods List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {loadingFoods ? (
                  // Loading Skeleton
                  <div className="space-y-2">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/40 animate-pulse bg-background/20">
                        <div className="w-11 h-11 rounded-lg bg-muted flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-muted rounded w-3/4" />
                          <div className="h-2 bg-muted rounded w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : categoryFoods.length > 0 ? (
                  categoryFoods.map((food) => (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => handleFoodSelect(food)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-border/40 hover:border-primary/20 bg-background/35 hover:bg-accent/40 text-left transition-all duration-200"
                    >
                      {food.image_url ? (
                        <img
                          src={food.image_url}
                          alt={food.name}
                          className="w-11 h-11 rounded-lg object-cover bg-muted flex-shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1585938338392-50a59970d2ee?w=120&auto=format&fit=crop';
                          }}
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-primary/12 border border-primary/24 flex items-center justify-center flex-shrink-0 text-primary">
                          {food.category === 'beverages' ? '☕' : food.category === 'fruits' ? '🍎' : '🍛'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-1">
                          <div className="flex items-center gap-1 truncate">
                            <p className="font-semibold text-xs text-foreground truncate">
                              {food.name}
                            </p>
                            {food.is_verified ? (
                              <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" title="Verified food" />
                            ) : (
                              <Badge className="bg-chart-carbs/10 text-chart-carbs border-0 text-[8px] h-4 py-0 px-1 font-normal flex-shrink-0">Custom</Badge>
                            )}
                          </div>
                          <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground whitespace-nowrap flex-shrink-0">
                            Serving: {food.serving_size}{food.serving_unit || 'g'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-[10px] text-muted-foreground font-medium font-mono tabular-nums">
                            {Math.round(food.calories)} kcal • P: {food.protein}g • C: {food.carbs}g • F: {food.fat}g • Fib: {food.fiber || 0}g
                            <span className="text-[8px] text-muted-foreground/60 block font-sans">Values per 100g</span>
                          </p>

                          {/* Owner controls for custom foods */}
                          {!food.is_verified && food.user_id === user?.id && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => handleEditClick(e, food)}
                                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-primary transition-colors"
                                title="Edit custom food"
                              >
                                <Edit3 className="w-3.5 h-3.5 animate-in" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteClick(e, food.id, food.name)}
                                className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-primary transition-colors"
                                title="Delete custom food"
                              >
                                <Trash2 className="w-3.5 h-3.5 animate-in" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-muted-foreground space-y-3">
                    <p>No items found matching "{indianSearchQuery}"</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        resetCustomFoodForm();
                        setCustomFoodForm((prev) => ({ ...prev, name: indianSearchQuery }));
                        setIsCustomDialogOpen(true);
                      }}
                      className="border-primary/20 text-primary hover:bg-primary/10 text-xs"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Add as Custom Food
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ai">
            <ChatMealLog />
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

                {/* Submit Button */}
                <div className="pt-8">
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
      </div>
      
      <BarcodeScanner 
        open={isScannerOpen} 
        onOpenChange={setIsScannerOpen} 
        onScanSuccess={handleFoodSelect} 
      />

      {/* Custom Food Creation & Edit Dialog */}
      <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
        <DialogContent className="bg-card border-border text-foreground max-w-sm rounded-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditingCustom ? 'Edit Custom Food' : 'Create Custom Food'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrUpdateCustomFood} className="space-y-4 pt-2">
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

            {!isEditingCustom && (
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
            )}

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
