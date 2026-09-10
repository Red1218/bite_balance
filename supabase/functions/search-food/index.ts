import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';
import { indianFoods } from './indianFoods.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface FoodResult {
  id: string;
  name: string;
  brand: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  serving_size: string;
  barcode: string;
  image_url: string;
}

interface DBFoodItem {
  id: string;
  name: string;
  category: string;
  serving_size: number;
  serving_unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  is_verified: boolean;
  user_id: string | null;
  image_url: string | null;
  created_at: string;
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, number>;
  serving_size?: string;
  image_small_url?: string;
}

// Local database of common generic whole foods/raw ingredients
const genericFoods: Omit<FoodResult, 'id'>[] = [
  {
    name: 'White Rice (Cooked)',
    brand: 'Generic Raw Ingredient',
    calories: 130,
    protein: 2.7,
    carbs: 28,
    fat: 0.3,
    fiber: 0.4,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=120&auto=format&fit=crop',
  },
  {
    name: 'Brown Rice (Cooked)',
    brand: 'Generic Raw Ingredient',
    calories: 111,
    protein: 2.6,
    carbs: 23,
    fat: 0.9,
    fiber: 1.8,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1536304997881-a372c179924b?w=120&auto=format&fit=crop',
  },
  {
    name: 'Chicken Breast (Cooked, Boneless)',
    brand: 'Generic Raw Ingredient',
    calories: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    fiber: 0,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=120&auto=format&fit=crop',
  },
  {
    name: 'Egg (Whole, Cooked)',
    brand: 'Generic Raw Ingredient',
    calories: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
    fiber: 0,
    serving_size: '100g (approx. 2 eggs)',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1582722872445-44c5aba7e3c5?w=120&auto=format&fit=crop',
  },
  {
    name: 'Banana (Raw)',
    brand: 'Generic Raw Ingredient',
    calories: 89,
    protein: 1.1,
    carbs: 22.8,
    fat: 0.3,
    fiber: 2.6,
    serving_size: '100g (1 medium banana is ~120g)',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=120&auto=format&fit=crop',
  },
  {
    name: 'Whole Milk',
    brand: 'Generic Raw Ingredient',
    calories: 61,
    protein: 3.2,
    carbs: 4.8,
    fat: 3.3,
    fiber: 0,
    serving_size: '100ml',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=120&auto=format&fit=crop',
  },
  {
    name: 'Oatmeal (Cooked in Water)',
    brand: 'Generic Raw Ingredient',
    calories: 71,
    protein: 2.5,
    carbs: 12,
    fat: 1.5,
    fiber: 1.7,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1517686469429-8faf88b9f7ad?w=120&auto=format&fit=crop',
  },
  {
    name: 'Apple (with skin, Raw)',
    brand: 'Generic Raw Ingredient',
    calories: 52,
    protein: 0.3,
    carbs: 14,
    fat: 0.2,
    fiber: 2.4,
    serving_size: '100g (1 medium apple is ~180g)',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=120&auto=format&fit=crop',
  },
  {
    name: 'Broccoli (Cooked)',
    brand: 'Generic Raw Ingredient',
    calories: 35,
    protein: 2.4,
    carbs: 7.2,
    fat: 0.4,
    fiber: 3.3,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=120&auto=format&fit=crop',
  },
  {
    name: 'Salmon (Cooked)',
    brand: 'Generic Raw Ingredient',
    calories: 206,
    protein: 22,
    carbs: 0,
    fat: 12,
    fiber: 0,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=120&auto=format&fit=crop',
  },
  {
    name: 'Sweet Potato (Baked)',
    brand: 'Generic Raw Ingredient',
    calories: 90,
    protein: 2,
    carbs: 21,
    fat: 0.2,
    fiber: 3.3,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?w=120&auto=format&fit=crop',
  },
  {
    name: 'Avocado (Raw)',
    brand: 'Generic Raw Ingredient',
    calories: 160,
    protein: 2,
    carbs: 8.5,
    fat: 15,
    fiber: 6.7,
    serving_size: '100g',
    barcode: '',
    image_url: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=120&auto=format&fit=crop',
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, page = 1 } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(JSON.stringify({ foods: [], total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Searching for: ${query}, page: ${page}`);

    const queryLower = query.trim().toLowerCase();
    
    // 1. Get matches from database / local Indian food list
    const matchedIndian: FoodResult[] = [];
    
    if (page === 1) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        const authHeader = req.headers.get('Authorization') || '';
        
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
              headers: authHeader ? { Authorization: authHeader } : {},
            },
          });
          const { data, error: dbError } = await supabase
            .rpc('search_foods', { search_query: queryLower });
            
          if (!dbError && data && data.length > 0) {
            console.log(`Found ${data.length} Indian foods in DB`);
            const items = data as DBFoodItem[];
            items.forEach((item) => {
              const displayServing = item.serving_size 
                ? `${Number(item.serving_size)} ${item.serving_unit || 'g'}`
                : '100g';

              matchedIndian.push({
                id: item.id || `indian-db-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
                name: item.name,
                brand: item.is_verified ? 'Verified Indian Food' : 'Custom Indian Food',
                calories: Math.round(Number(item.calories) || 0),
                protein: Math.round((Number(item.protein) || 0) * 10) / 10,
                carbs: Math.round((Number(item.carbs) || 0) * 10) / 10,
                fat: Math.round((Number(item.fat) || 0) * 10) / 10,
                fiber: Math.round((Number(item.fiber) || 0) * 10) / 10,
                serving_size: displayServing,
                barcode: '',
                image_url: item.image_url || '',
                category: item.category || 'south_indian',
              });
            });
          }
        }
      } catch (dbErr) {
        console.warn('Failed querying search_foods RPC from DB. Falling back to local array.', dbErr);
      }
      
      // Fallback search in the local indianFoods array if no DB matches are found
      if (matchedIndian.length === 0) {
        const localMatches = indianFoods.filter((f) =>
          f.name.toLowerCase().includes(queryLower)
        );
        localMatches.forEach((item, idx) => {
          matchedIndian.push({
            id: `indian-local-${item.name.toLowerCase().replace(/\s+/g, '-')}-${idx}`,
            name: item.name,
            brand: item.brand,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            serving_size: item.serving_size,
            barcode: '',
            image_url: item.image_url || '',
          });
        });
      }
    }

    // 2. Get matches from generic raw ingredients list
    const matchedGeneric: FoodResult[] = [];

    if (page === 1) {
      const matches = genericFoods.filter((f) =>
        f.name.toLowerCase().includes(queryLower)
      );
      matches.forEach((item) => {
        matchedGeneric.push({
          id: `generic-${item.name.toLowerCase().replace(/\s+/g, '-')}`,
          ...item,
        });
      });
    }

    // 3. Get matches from Open Food Facts API
    const searchUrl = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    searchUrl.searchParams.set('search_terms', query);
    searchUrl.searchParams.set('search_simple', '1');
    searchUrl.searchParams.set('action', 'process');
    searchUrl.searchParams.set('json', '1');
    searchUrl.searchParams.set('page_size', '20');
    searchUrl.searchParams.set('page', String(page));
    searchUrl.searchParams.set(
      'fields',
      'code,product_name,brands,nutriments,serving_size,image_small_url'
    );

    let apiFoods: FoodResult[] = [];
    try {
      const response = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'BiteBalance/1.0 (Calorie Tracker App)',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`Found ${data.count || 0} Open Food Facts results`);
        apiFoods = (data.products || [])
          .map((product: OFFProduct) => {
            const nutriments = product.nutriments || {};
            return {
              id: product.code || crypto.randomUUID(),
              name: product.product_name || 'Unknown Product',
              brand: product.brands || '',
              calories: Math.round(
                nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0
              ),
              protein:
                Math.round(
                  (nutriments.proteins_100g || nutriments.proteins || 0) * 10
                ) / 10,
              carbs:
                Math.round(
                  (nutriments.carbohydrates_100g || nutriments.carbohydrates || 0) *
                    10
                ) / 10,
              fat:
                Math.round((nutriments.fat_100g || nutriments.fat || 0) * 10) / 10,
              fiber:
                Math.round((nutriments.fiber_100g || nutriments.fiber || 0) * 10) /
                10,
              serving_size: product.serving_size || '100g',
              barcode: product.code || '',
              image_url: product.image_small_url || '',
            };
          })
          .filter((food: FoodResult) => food.name !== 'Unknown Product');
      }
    } catch (apiErr) {
      console.error('Open Food Facts API request failed:', apiErr);
    }

    const combinedFoods = [...matchedIndian, ...matchedGeneric, ...apiFoods];

    return new Response(
      JSON.stringify({
        foods: combinedFoods,
        total: combinedFoods.length,
        page,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Search food error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to search foods' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

