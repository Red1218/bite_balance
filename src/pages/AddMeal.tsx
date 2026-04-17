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
import { ArrowLeft, Search, Edit3 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/manualClient';
import { useAuth } from '@/contexts/AuthContext';
import { FoodSearch } from '@/components/FoodSearch';
import { FoodResult } from '@/hooks/useFoodSearch';

const AddMeal = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('search');
  const [mealData, setMealData] = useState({
    name: '',
    mealTime: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleFoodSelect = (food: FoodResult) => {
    setMealData({
      ...mealData,
      name: food.brand ? `${food.name} - ${food.brand}` : food.name,
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
      fiber: String(food.fiber),
    });
    setActiveTab('manual');
    toast({
      title: 'Food selected',
      description: 'Review the nutritional info and select meal time to save.',
    });
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
        mealTime: '',
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
        <div className="flex items-center gap-4 mb-6">
          <Link to="/">
            <Button
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">Add New Meal</h1>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Search
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
            <div className="glass-card p-6">
              <p className="text-sm text-muted-foreground mb-4">
                Search for foods to auto-fill nutritional information
              </p>
              <FoodSearch onSelect={handleFoodSelect} />
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <div className="glass-card p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Meal Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground text-base">
                    Meal Name
                  </Label>
                  <Input
                    id="name"
                    value={mealData.name}
                    onChange={(e) =>
                      setMealData({ ...mealData, name: e.target.value })
                    }
                    placeholder="e.g., Chicken Salad"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base backdrop-blur-sm"
                    required
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
                    onChange={(e) =>
                      setMealData({ ...mealData, calories: e.target.value })
                    }
                    placeholder="Enter total calories"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base backdrop-blur-sm"
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
                        className="text-muted-foreground text-sm"
                      >
                        Protein (g)
                      </Label>
                      <Input
                        id="protein"
                        type="number"
                        step="0.1"
                        value={mealData.protein}
                        onChange={(e) =>
                          setMealData({ ...mealData, protein: e.target.value })
                        }
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="carbs"
                        className="text-muted-foreground text-sm"
                      >
                        Carbs (g)
                      </Label>
                      <Input
                        id="carbs"
                        type="number"
                        step="0.1"
                        value={mealData.carbs}
                        onChange={(e) =>
                          setMealData({ ...mealData, carbs: e.target.value })
                        }
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label
                        htmlFor="fat"
                        className="text-muted-foreground text-sm"
                      >
                        Fats (g)
                      </Label>
                      <Input
                        id="fat"
                        type="number"
                        step="0.1"
                        value={mealData.fat}
                        onChange={(e) =>
                          setMealData({ ...mealData, fat: e.target.value })
                        }
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="fiber"
                        className="text-muted-foreground text-sm"
                      >
                        Fiber (g)
                      </Label>
                      <Input
                        id="fiber"
                        type="number"
                        step="0.1"
                        value={mealData.fiber}
                        onChange={(e) =>
                          setMealData({ ...mealData, fiber: e.target.value })
                        }
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Meal Time */}
                <div className="space-y-2">
                  <Label
                    htmlFor="mealTime"
                    className="text-foreground text-base"
                  >
                    Meal Time
                  </Label>
                  <Select
                    value={mealData.mealTime}
                    onValueChange={(value) =>
                      setMealData({ ...mealData, mealTime: value })
                    }
                    required
                  >
                    <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl h-14 text-base backdrop-blur-sm [&>svg]:text-muted-foreground">
                      <SelectValue
                        placeholder="Select meal time"
                        className="text-muted-foreground"
                      />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border backdrop-blur-xl">
                      <SelectItem
                        value="breakfast"
                        className="text-foreground hover:bg-accent focus:bg-accent"
                      >
                        Breakfast
                      </SelectItem>
                      <SelectItem
                        value="lunch"
                        className="text-foreground hover:bg-accent focus:bg-accent"
                      >
                        Lunch
                      </SelectItem>
                      <SelectItem
                        value="dinner"
                        className="text-foreground hover:bg-accent focus:bg-accent"
                      >
                        Dinner
                      </SelectItem>
                      <SelectItem
                        value="snack"
                        className="text-foreground hover:bg-accent focus:bg-accent"
                      >
                        Snack
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                    className="w-full primary-button h-14 text-lg font-medium rounded-xl"
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
    </div>
  );
};

export default AddMeal;
