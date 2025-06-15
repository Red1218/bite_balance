
import { supabase } from "@/integrations/supabase/client";
import { SearchResult, FoodItem, NutrientValues } from "@/types/nutrients";

export class NutrientsApiService {
  static async searchFoods(searchTerm: string): Promise<SearchResult> {
    const { data, error } = await supabase.functions.invoke('search-food', {
      body: { searchTerm }
    });

    if (error) {
      throw new Error(`Failed to search foods: ${error.message}`);
    }

    return data;
  }

  static async getFoodDetails(fdcId: number): Promise<FoodItem> {
    const { data, error } = await supabase.functions.invoke('search-food', {
      body: { fdcId }
    });

    if (error) {
      throw new Error(`Failed to get food details: ${error.message}`);
    }

    return data;
  }

  static extractNutrients(foodItem: FoodItem): NutrientValues {
    const nutrients = foodItem.foodNutrients;
    
    // Nutrient IDs from USDA database
    const calories = nutrients.find(n => n.nutrientId === 1008)?.value || 0; // Energy
    const protein = nutrients.find(n => n.nutrientId === 1003)?.value || 0; // Protein
    const carbs = nutrients.find(n => n.nutrientId === 1005)?.value || 0; // Carbohydrate
    const fat = nutrients.find(n => n.nutrientId === 1004)?.value || 0; // Total lipid (fat)
    const fiber = nutrients.find(n => n.nutrientId === 1079)?.value || 0; // Fiber

    return {
      calories: Math.round(calories),
      protein: Math.round(protein * 10) / 10,
      carbs: Math.round(carbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      fiber: Math.round(fiber * 10) / 10
    };
  }
}
