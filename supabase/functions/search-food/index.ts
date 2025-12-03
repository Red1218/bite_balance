import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, page = 1 } = await req.json();

    if (!query || query.trim().length < 2) {
      return new Response(
        JSON.stringify({ foods: [], total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Searching for: ${query}, page: ${page}`);

    const searchUrl = new URL('https://world.openfoodfacts.org/cgi/search.pl');
    searchUrl.searchParams.set('search_terms', query);
    searchUrl.searchParams.set('search_simple', '1');
    searchUrl.searchParams.set('action', 'process');
    searchUrl.searchParams.set('json', '1');
    searchUrl.searchParams.set('page_size', '20');
    searchUrl.searchParams.set('page', String(page));
    searchUrl.searchParams.set('fields', 'code,product_name,brands,nutriments,serving_size,image_small_url');

    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'BiteBalance/1.0 (Calorie Tracker App)',
      },
    });

    if (!response.ok) {
      console.error('Open Food Facts API error:', response.status);
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Found ${data.count} results`);

    const foods: FoodResult[] = (data.products || []).map((product: any) => {
      const nutriments = product.nutriments || {};
      
      return {
        id: product.code || crypto.randomUUID(),
        name: product.product_name || 'Unknown Product',
        brand: product.brands || '',
        calories: Math.round(nutriments['energy-kcal_100g'] || nutriments['energy-kcal'] || 0),
        protein: Math.round((nutriments.proteins_100g || nutriments.proteins || 0) * 10) / 10,
        carbs: Math.round((nutriments.carbohydrates_100g || nutriments.carbohydrates || 0) * 10) / 10,
        fat: Math.round((nutriments.fat_100g || nutriments.fat || 0) * 10) / 10,
        fiber: Math.round((nutriments.fiber_100g || nutriments.fiber || 0) * 10) / 10,
        serving_size: product.serving_size || '100g',
        barcode: product.code || '',
        image_url: product.image_small_url || '',
      };
    }).filter((food: FoodResult) => food.name !== 'Unknown Product');

    return new Response(
      JSON.stringify({ 
        foods, 
        total: data.count || 0,
        page: data.page || 1,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Search food error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to search foods' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
