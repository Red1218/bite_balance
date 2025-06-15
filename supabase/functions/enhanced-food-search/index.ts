
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FoodItem {
  id: string
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  source: 'USDA' | 'INDIAN' | 'CUSTOM'
  category?: string
}

interface USDAFood {
  fdcId: number
  description: string
  foodNutrients: Array<{
    nutrientId: number
    value: number
  }>
}

interface EdamamFood {
  food: {
    foodId: string
    label: string
    nutrients: {
      ENERC_KCAL?: number
      PROCNT?: number
      CHOCDF?: number
      FAT?: number
      FIBTG?: number
    }
  }
}

// Common Indian dishes database
const INDIAN_FOODS: FoodItem[] = [
  {
    id: 'basmati-rice-cooked',
    name: 'Basmati Rice (Cooked)',
    calories: 130,
    protein: 2.7,
    carbs: 25,
    fat: 0.3,
    fiber: 0.4,
    source: 'CUSTOM',
    category: 'Rice & Grains'
  },
  {
    id: 'chapati-whole-wheat',
    name: 'Chapati (Whole Wheat)',
    calories: 104,
    protein: 3.1,
    carbs: 18,
    fat: 2.4,
    fiber: 2.8,
    source: 'CUSTOM',
    category: 'Bread'
  },
  {
    id: 'dal-moong-cooked',
    name: 'Moong Dal (Cooked)',
    calories: 104,
    protein: 7.0,
    carbs: 16.3,
    fat: 0.4,
    fiber: 2.0,
    source: 'CUSTOM',
    category: 'Lentils'
  },
  {
    id: 'dal-masoor-cooked',
    name: 'Masoor Dal (Cooked)',
    calories: 116,
    protein: 9.0,
    carbs: 20,
    fat: 0.4,
    fiber: 7.9,
    source: 'CUSTOM',
    category: 'Lentils'
  },
  {
    id: 'aloo-gobi-curry',
    name: 'Aloo Gobi (Potato Cauliflower Curry)',
    calories: 85,
    protein: 2.5,
    carbs: 12,
    fat: 3.5,
    fiber: 3.2,
    source: 'CUSTOM',
    category: 'Vegetables'
  },
  {
    id: 'palak-paneer',
    name: 'Palak Paneer',
    calories: 180,
    protein: 11,
    carbs: 8,
    fat: 12,
    fiber: 2.5,
    source: 'CUSTOM',
    category: 'Vegetables'
  },
  {
    id: 'chicken-biryani',
    name: 'Chicken Biryani',
    calories: 220,
    protein: 15,
    carbs: 25,
    fat: 8,
    fiber: 1.5,
    source: 'CUSTOM',
    category: 'Rice Dishes'
  },
  {
    id: 'vegetable-biryani',
    name: 'Vegetable Biryani',
    calories: 180,
    protein: 4,
    carbs: 32,
    fat: 5,
    fiber: 3,
    source: 'CUSTOM',
    category: 'Rice Dishes'
  },
  {
    id: 'samosa-vegetable',
    name: 'Vegetable Samosa',
    calories: 262,
    protein: 5.4,
    carbs: 27,
    fat: 15,
    fiber: 2.8,
    source: 'CUSTOM',
    category: 'Snacks'
  },
  {
    id: 'dhokla-steamed',
    name: 'Dhokla (Steamed)',
    calories: 160,
    protein: 6,
    carbs: 30,
    fat: 2,
    fiber: 2.5,
    source: 'CUSTOM',
    category: 'Snacks'
  },
  {
    id: 'naan-plain',
    name: 'Naan (Plain)',
    calories: 262,
    protein: 9,
    carbs: 45,
    fat: 5,
    fiber: 2,
    source: 'CUSTOM',
    category: 'Bread'
  },
  {
    id: 'paratha-plain',
    name: 'Paratha (Plain)',
    calories: 320,
    protein: 8,
    carbs: 38,
    fat: 15,
    fiber: 3,
    source: 'CUSTOM',
    category: 'Bread'
  },
  {
    id: 'rajma-curry',
    name: 'Rajma (Kidney Bean Curry)',
    calories: 140,
    protein: 8.7,
    carbs: 22.8,
    fat: 0.5,
    fiber: 6.4,
    source: 'CUSTOM',
    category: 'Lentils'
  },
  {
    id: 'chole-chickpea-curry',
    name: 'Chole (Chickpea Curry)',
    calories: 164,
    protein: 8.9,
    carbs: 27,
    fat: 2.6,
    fiber: 7.6,
    source: 'CUSTOM',
    category: 'Lentils'
  },
  {
    id: 'idli-steamed',
    name: 'Idli (Steamed Rice Cake)',
    calories: 58,
    protein: 2,
    carbs: 12,
    fat: 0.1,
    fiber: 0.6,
    source: 'CUSTOM',
    category: 'South Indian'
  },
  {
    id: 'dosa-plain',
    name: 'Dosa (Plain)',
    calories: 168,
    protein: 4,
    carbs: 33,
    fat: 2,
    fiber: 1.5,
    source: 'CUSTOM',
    category: 'South Indian'
  }
];

function mapUSDANutrients(foodNutrients: Array<{ nutrientId: number; value: number }>) {
  const nutrients = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  };

  foodNutrients.forEach(nutrient => {
    switch (nutrient.nutrientId) {
      case 1008: // Energy (calories)
        nutrients.calories = nutrient.value;
        break;
      case 1003: // Protein
        nutrients.protein = nutrient.value;
        break;
      case 1005: // Carbohydrates
        nutrients.carbs = nutrient.value;
        break;
      case 1004: // Total fat
        nutrients.fat = nutrient.value;
        break;
      case 1079: // Fiber
        nutrients.fiber = nutrient.value;
        break;
    }
  });

  return nutrients;
}

async function searchUSDA(query: string): Promise<FoodItem[]> {
  try {
    const apiKey = Deno.env.get('USDA_API_KEY');
    if (!apiKey) return [];

    const response = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=10`
    );

    if (!response.ok) return [];

    const data = await response.json();
    
    return data.foods?.map((food: USDAFood) => {
      const nutrients = mapUSDANutrients(food.foodNutrients);
      return {
        id: `usda-${food.fdcId}`,
        name: food.description,
        source: 'USDA' as const,
        ...nutrients
      };
    }) || [];
  } catch (error) {
    console.error('USDA search error:', error);
    return [];
  }
}

async function searchEdamam(query: string): Promise<FoodItem[]> {
  try {
    // Note: Users would need to add their Edamam credentials
    const appId = Deno.env.get('EDAMAM_APP_ID');
    const appKey = Deno.env.get('EDAMAM_APP_KEY');
    
    if (!appId || !appKey) return [];

    const response = await fetch(
      `https://api.edamam.com/api/food-database/v2/parser?app_id=${appId}&app_key=${appKey}&ingr=${encodeURIComponent(query)}&nutrition-type=cooking`
    );

    if (!response.ok) return [];

    const data = await response.json();
    
    return data.parsed?.map((item: EdamamFood) => ({
      id: `edamam-${item.food.foodId}`,
      name: item.food.label,
      calories: item.food.nutrients.ENERC_KCAL || 0,
      protein: item.food.nutrients.PROCNT || 0,
      carbs: item.food.nutrients.CHOCDF || 0,
      fat: item.food.nutrients.FAT || 0,
      fiber: item.food.nutrients.FIBTG || 0,
      source: 'INDIAN' as const
    })) || [];
  } catch (error) {
    console.error('Edamam search error:', error);
    return [];
  }
}

function searchIndianFoods(query: string): FoodItem[] {
  const searchTerm = query.toLowerCase();
  return INDIAN_FOODS.filter(food => 
    food.name.toLowerCase().includes(searchTerm) ||
    food.category?.toLowerCase().includes(searchTerm)
  );
}

function isLikelyIndianFood(query: string): boolean {
  const indianTerms = [
    'dal', 'chapati', 'naan', 'biryani', 'curry', 'samosa', 'dhokla',
    'idli', 'dosa', 'paratha', 'rajma', 'chole', 'paneer', 'aloo',
    'gobi', 'palak', 'masala', 'tandoor', 'basmati', 'moong', 'masoor',
    'chana', 'roti', 'sabzi', 'pulao', 'korma', 'vindaloo', 'tikka'
  ];
  
  const queryLower = query.toLowerCase();
  return indianTerms.some(term => queryLower.includes(term));
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();
    
    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ foods: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching for:', query);

    // Prioritize Indian food search if query seems Indian
    const prioritizeIndian = isLikelyIndianFood(query);
    
    // Search all sources concurrently
    const [usdaResults, edamamResults, indianResults] = await Promise.all([
      prioritizeIndian ? [] : searchUSDA(query), // Skip USDA for Indian queries to save API calls
      searchEdamam(query),
      searchIndianFoods(query)
    ]);

    // If no Indian results found and we prioritized Indian, fallback to USDA
    const finalUsdaResults = prioritizeIndian && indianResults.length === 0 && edamamResults.length === 0 
      ? await searchUSDA(query) 
      : usdaResults;

    // Combine and sort results - Indian foods first if query seems Indian
    let allResults = [...indianResults, ...edamamResults, ...finalUsdaResults];
    
    if (!prioritizeIndian) {
      allResults = [...finalUsdaResults, ...edamamResults, ...indianResults];
    }

    // Remove duplicates and limit results
    const uniqueResults = allResults
      .filter((food, index, self) => 
        index === self.findIndex(f => f.name.toLowerCase() === food.name.toLowerCase())
      )
      .slice(0, 15);

    console.log(`Found ${uniqueResults.length} results from multiple sources`);

    return new Response(
      JSON.stringify({ foods: uniqueResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({ error: 'Search failed', foods: [] }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
