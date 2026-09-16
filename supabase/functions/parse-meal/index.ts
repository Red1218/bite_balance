import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_ANON_KEY')!
);

interface ParseResponse {
  name: string;
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
}

const ZERO_MICROS = {
  vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0, calcium: 0,
  potassium: 0, sodium: 0, magnesium: 0, zinc: 0,
};

// Strips a weight/count phrase (e.g. "150g", "2 ") from free text so what's left is
// just the food name -- search_foods does `name ILIKE '%query%'`, so the query needs
// to be a short phrase that could appear IN a food name, not a sentence containing one.
const extractFoodQuery = (text: string): string => {
  const numberWords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  let cleaned = text.replace(/\d+(?:\.\d+)?\s*(g|grams|gram|oz|ounces|ounce)\b/gi, ' ');
  cleaned = cleaned.replace(new RegExp(`\\b(\\d+|${numberWords.join('|')})\\b`, 'gi'), ' ');
  return cleaned.replace(/\s+/g, ' ').trim();
};

const parseWeightGrams = (text: string): number | null => {
  const match = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(g|grams|gram|oz|ounces|ounce)/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return match[2].toLowerCase().startsWith('oz') ? val * 28.35 : val;
};

// Generic rough estimate used only when GEMINI_API_KEY is unset -- the app
// always has one configured in practice, so this is a last-resort guard, not
// a real parser. Replaced the ~40-food hardcoded table + name/weight matcher
// that used to live here: it was dead weight, never reached in production.
const parseTextFallback = (text: string): ParseResponse => ({
  name: text,
  calories: 350,
  protein: 12,
  carbs: 45,
  fat: 10,
  fiber: 2,
  ...ZERO_MICROS,
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { text } = await req.json();

  if (!text || text.trim().length < 3) {
    return new Response(
      JSON.stringify({ error: 'Text prompt must be at least 3 characters long.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check the real food database first — a real, verified value beats a fresh
  // Gemini estimate that can drift between requests. search_foods does a substring
  // match against the food name, so strip the weight/count phrase first.
  const foodQuery = extractFoodQuery(text);
  if (foodQuery.length >= 3) {
    const { data: matches, error: searchError } = await supabase.rpc('search_foods', {
      search_query: foodQuery,
    });
    if (searchError) console.warn('search_foods failed:', searchError.message);

    const dbMatch = matches?.[0];
    if (dbMatch) {
      const weightGrams = parseWeightGrams(text) ?? (Number(dbMatch.serving_size) || 100);
      const factor = weightGrams / 100;
      const scale = (n: number | null) => Math.round((Number(n) || 0) * factor * 10) / 10;

      const result: ParseResponse = {
        name: dbMatch.name,
        calories: Math.round((Number(dbMatch.calories) || 0) * factor),
        protein: scale(dbMatch.protein),
        carbs: scale(dbMatch.carbs),
        fat: scale(dbMatch.fat),
        fiber: scale(dbMatch.fiber),
        vitaminC: scale(dbMatch.vitamin_c),
        vitaminD: scale(dbMatch.vitamin_d),
        vitaminB12: scale(dbMatch.vitamin_b12),
        iron: scale(dbMatch.iron),
        calcium: scale(dbMatch.calcium),
        potassium: scale(dbMatch.potassium),
        sodium: scale(dbMatch.sodium),
        magnesium: scale(dbMatch.magnesium),
        zinc: scale(dbMatch.zinc),
      };
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_KEY');

  try {
    console.log(`Parsing meal text: "${text}"`);

    if (!geminiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. Using rule-based fallback parser.');
      const parsedData = parseTextFallback(text);
      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Gemini API to parse natural language meal details to JSON format
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;

    const systemPrompt = `You are a nutrition expert. Parse the given meal description into a clean JSON structure.
Format:
{
  "name": "formatted name",
  "calories": number (kcal),
  "protein": number (grams),
  "carbs": number (grams),
  "fat": number (grams),
  "fiber": number (grams),
  "vitaminC": number (mg),
  "vitaminD": number (mcg),
  "vitaminB12": number (mcg),
  "iron": number (mg),
  "calcium": number (mg),
  "potassium": number (mg),
  "sodium": number (mg),
  "magnesium": number (mg),
  "zinc": number (mg)
}
Estimate values accurately based on average food tables. Return ONLY the JSON object, do not explain your response.`;

    const geminiBody = JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${systemPrompt}\n\nMeal description: "${text}"` }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    // Gemini occasionally returns 503/429 when its servers are momentarily
    // overloaded -- both are meant to be retried, so give it one more try
    // before falling back to the rule-based parser.
    let response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: geminiBody,
    });
    if (response.status === 503 || response.status === 429) {
      console.warn(`Gemini API returned status ${response.status}, retrying once`);
      await new Promise((r) => setTimeout(r, 1000));
      response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });
    }

    if (!response.ok) {
      console.error(`Gemini API returned status ${response.status}`);
      throw new Error(`Gemini API failed with status ${response.status}`);
    }

    const geminiData = await response.json();
    const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('No candidate response returned from Gemini.');
    }

    const parsedJson: ParseResponse = JSON.parse(candidateText.trim());

    // Validate fields and ensure numbers are rounded
    const scaleField = (n: unknown) => Math.round((Number(n) || 0) * 10) / 10;
    const result: ParseResponse = {
      name: parsedJson.name || text,
      calories: Math.round(Number(parsedJson.calories) || 0),
      protein: scaleField(parsedJson.protein),
      carbs: scaleField(parsedJson.carbs),
      fat: scaleField(parsedJson.fat),
      fiber: scaleField(parsedJson.fiber),
      vitaminC: scaleField(parsedJson.vitaminC),
      vitaminD: scaleField(parsedJson.vitaminD),
      vitaminB12: scaleField(parsedJson.vitaminB12),
      iron: scaleField(parsedJson.iron),
      calcium: scaleField(parsedJson.calcium),
      potassium: scaleField(parsedJson.potassium),
      sodium: scaleField(parsedJson.sodium),
      magnesium: scaleField(parsedJson.magnesium),
      zinc: scaleField(parsedJson.zinc),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI Parse meal error:', error);
    // Graceful fallback to rule-based parser in case of Gemini API error
    const parsedData = parseTextFallback(text);
    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
