import { useState, Suspense, lazy } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Search, Calculator } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Lazy load heavy components
const FoodSearch = lazy(() => import("@/components/FoodSearch"));
const PortionCalculator = lazy(() => import("@/components/PortionCalculator"));

interface FoodItem {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: 'USDA' | 'INDIAN' | 'CUSTOM';
  category?: string;
}

const ComponentLoader = () => (
  <div className="animate-pulse">
    <div className="h-12 bg-muted rounded-xl mb-4"></div>
    <div className="h-24 bg-muted rounded-xl"></div>
  </div>
);

const AddMeal = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [mealData, setMealData] = useState({
    name: "",
    mealTime: "",
    calories: "",
    protein: "",
    carbs: "",
    fat: "",
    fiber: "",
    date: new Date().toISOString().split('T')[0],
    notes: ""
  });

  const handleFoodSelect = (food: FoodItem) => {
    console.log('Food selected:', food);
    setSelectedFood(food);
    setMealData(prev => ({
      ...prev,
      name: food.name,
      // Don't set nutritional values here - let the portion calculator handle them
    }));
    
    toast({
      title: "Food Selected",
      description: `${food.name} selected. Enter portion size to calculate nutrition.`,
    });
  };

  const handleCalculatedValues = (values: {
    calories: string;
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
  }) => {
    console.log('Calculated values received:', values);
    setMealData(prev => ({
      ...prev,
      ...values
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('Form submission started with data:', mealData);
    
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to add meals",
        variant: "destructive"
      });
      return;
    }

    if (!mealData.name || !mealData.mealTime || !mealData.calories) {
      toast({
        title: "Error", 
        description: "Please fill in meal name, meal time, and calories",
        variant: "destructive"
      });
      return;
    }

    if (Number(mealData.calories) <= 0) {
      toast({
        title: "Error", 
        description: "Please enter a valid portion size to calculate calories",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    
    try {
      const mealToInsert = {
        user_id: user.id,
        name: mealData.name,
        calories: Number(mealData.calories),
        protein: Number(mealData.protein) || 0,
        carbs: Number(mealData.carbs) || 0,
        fat: Number(mealData.fat) || 0,
        fiber: Number(mealData.fiber) || 0,
        meal_time: mealData.mealTime,
        logged_date: mealData.date
      };

      console.log('Inserting meal:', mealToInsert);

      const { error } = await supabase
        .from('daily_meals')
        .insert(mealToInsert);

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      toast({
        title: "Meal added",
        description: `"${mealData.name}" has been added to your daily log.`,
      });
      
      // Reset form
      setMealData({
        name: "",
        mealTime: "",
        calories: "",
        protein: "",
        carbs: "",
        fat: "",
        fiber: "",
        date: new Date().toISOString().split('T')[0],
        notes: ""
      });
      setSelectedFood(null);

      // Navigate back to dashboard
      navigate("/");
    } catch (error) {
      console.error('Error adding meal:', error);
      toast({
        title: "Error",
        description: "Failed to add meal. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link to="/">
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-accent">
              <ArrowLeft className="w-6 h-6" />
            </Button>
          </Link>
          <h1 className="text-xl font-medium text-foreground">Add New Meal</h1>
        </div>

        <div className="space-y-6">
          {/* Food Search Section */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg text-foreground">Search Foods</CardTitle>
              </div>
              <p className="text-sm text-muted-foreground">
                Search our database including Indian cuisine, USDA foods, and international dishes
              </p>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<ComponentLoader />}>
                <FoodSearch onFoodSelect={handleFoodSelect} />
              </Suspense>
            </CardContent>
          </Card>

          {/* Portion Calculator */}
          <Suspense fallback={<ComponentLoader />}>
            <PortionCalculator 
              selectedFood={selectedFood}
              onCalculatedValues={handleCalculatedValues}
            />
          </Suspense>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">OR</span>
            <Separator className="flex-1" />
          </div>

          {/* Manual Entry Form */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg text-foreground">Manual Entry</CardTitle>
              <p className="text-sm text-muted-foreground">
                Enter meal details manually or modify calculated values
              </p>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Meal Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground text-base">Meal Name *</Label>
                  <Input
                    id="name"
                    value={mealData.name}
                    onChange={(e) => setMealData({ ...mealData, name: e.target.value })}
                    placeholder="e.g., Chicken Salad, Dal Rice, Biryani"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base backdrop-blur-sm"
                    required
                  />
                </div>

                {/* Calories */}
                <div className="space-y-2">
                  <Label htmlFor="calories" className="text-foreground text-base">Calories *</Label>
                  <Input
                    id="calories"
                    type="number"
                    value={mealData.calories}
                    onChange={(e) => setMealData({ ...mealData, calories: e.target.value })}
                    placeholder="Enter total calories"
                    className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-14 text-base backdrop-blur-sm"
                    required
                    min="1"
                  />
                </div>

                {/* Macronutrients */}
                <div className="space-y-4">
                  <h3 className="text-foreground text-base font-medium">Macronutrients (optional)</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="protein" className="text-muted-foreground text-sm">Protein (g)</Label>
                      <Input
                        id="protein"
                        type="number"
                        step="0.1"
                        value={mealData.protein}
                        onChange={(e) => setMealData({ ...mealData, protein: e.target.value })}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="carbs" className="text-muted-foreground text-sm">Carbs (g)</Label>
                      <Input
                        id="carbs"
                        type="number"
                        step="0.1"
                        value={mealData.carbs}
                        onChange={(e) => setMealData({ ...mealData, carbs: e.target.value })}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fat" className="text-muted-foreground text-sm">Fats (g)</Label>
                      <Input
                        id="fat"
                        type="number"
                        step="0.1"
                        value={mealData.fat}
                        onChange={(e) => setMealData({ ...mealData, fat: e.target.value })}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                        min="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="fiber" className="text-muted-foreground text-sm">Fiber (g)</Label>
                      <Input
                        id="fiber"
                        type="number"
                        step="0.1"
                        value={mealData.fiber}
                        onChange={(e) => setMealData({ ...mealData, fiber: e.target.value })}
                        placeholder="g"
                        className="bg-background/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl h-12 backdrop-blur-sm"
                        min="0"
                      />
                    </div>
                  </div>
                </div>

                {/* Meal Time */}
                <div className="space-y-2">
                  <Label htmlFor="mealTime" className="text-foreground text-base">Meal Time *</Label>
                  <Select 
                    value={mealData.mealTime} 
                    onValueChange={(value) => setMealData({ ...mealData, mealTime: value })}
                    required
                  >
                    <SelectTrigger className="bg-background/50 border-border text-foreground rounded-xl h-14 text-base backdrop-blur-sm [&>svg]:text-muted-foreground">
                      <SelectValue placeholder="Select meal time" className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border backdrop-blur-xl">
                      <SelectItem value="breakfast" className="text-foreground hover:bg-accent focus:bg-accent">Breakfast</SelectItem>
                      <SelectItem value="lunch" className="text-foreground hover:bg-accent focus:bg-accent">Lunch</SelectItem>
                      <SelectItem value="dinner" className="text-foreground hover:bg-accent focus:bg-accent">Dinner</SelectItem>
                      <SelectItem value="snack" className="text-foreground hover:bg-accent focus:bg-accent">Snack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <Button 
                    type="submit" 
                    className="w-full primary-button h-14 text-lg font-medium rounded-xl"
                    disabled={loading || !mealData.name || !mealData.mealTime || !mealData.calories}
                  >
                    {loading ? "Adding..." : "Add Meal"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddMeal;
