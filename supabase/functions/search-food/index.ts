
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchTerm, fdcId } = await req.json();
    const apiKey = Deno.env.get('USDA_API_KEY');

    if (!apiKey) {
      throw new Error('USDA API key not configured');
    }

    let response;
    
    if (fdcId) {
      // Get detailed food information by FDC ID
      response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`);
    } else if (searchTerm) {
      // Search for foods
      response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchTerm,
          dataType: ['Foundation', 'SR Legacy'],
          pageSize: 20,
          pageNumber: 1,
          sortBy: 'dataType.keyword',
          sortOrder: 'asc'
        }),
      });
    } else {
      throw new Error('Either searchTerm or fdcId is required');
    }

    if (!response.ok) {
      throw new Error(`USDA API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in search-food function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
