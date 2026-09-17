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

// Generic rough estimate used only when OPENAI_API_KEY is unset -- the app
// always has one configured in practice, so this is a last-resort guard, not
// a real parser.
const parseTextFallback = (text: string): ParseResponse => ({
  name: text,
  calories: 350,
  protein: 12,
  carbs: 45,
  fat: 10,
  fiber: 2,
  ...ZERO_MICROS,
});

const OPENAI_MODEL = 'gpt-5-mini';

const PARSE_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    fiber: { type: 'number' },
    vitaminC: { type: 'number' },
    vitaminD: { type: 'number' },
    vitaminB12: { type: 'number' },
    iron: { type: 'number' },
    calcium: { type: 'number' },
    potassium: { type: 'number' },
    sodium: { type: 'number' },
    magnesium: { type: 'number' },
    zinc: { type: 'number' },
  },
  required: [
    'name', 'calories', 'protein', 'carbs', 'fat', 'fiber',
    'vitaminC', 'vitaminD', 'vitaminB12', 'iron', 'calcium', 'potassium', 'sodium', 'magnesium', 'zinc',
  ],
  additionalProperties: false,
};

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
  // model estimate that can drift between requests. search_foods does a substring
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

  const openaiKey = Deno.env.get('OPENAI_API_KEY');

  try {
    console.log(`Parsing meal text: "${text}"`);

    if (!openaiKey) {
      console.warn('OPENAI_API_KEY environment variable is not set. Using rule-based fallback parser.');
      const parsedData = parseTextFallback(text);
      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = 'You are a nutrition expert. Parse the given meal description into a clean, accurate nutrition estimate, scaled to the portion described. Estimate values accurately based on average food tables.';

    const openaiBody = JSON.stringify({
      model: OPENAI_MODEL,
      reasoning: { effort: 'low' },
      input: [
        { role: 'developer', content: systemPrompt },
        { role: 'user', content: `Meal description: "${text}"` },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'parse_meal_response',
          strict: true,
          schema: PARSE_RESPONSE_SCHEMA,
        },
      },
    });

    // OpenAI occasionally returns 503/429 when momentarily overloaded or
    // rate-limited -- both are meant to be retried, so give it one more try
    // before falling back to the rule-based parser.
    const openaiHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` };
    let response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: openaiHeaders,
      body: openaiBody,
    });
    if (response.status === 503 || response.status === 429) {
      console.warn(`OpenAI API returned status ${response.status}, retrying once`);
      await new Promise((r) => setTimeout(r, 1000));
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: openaiHeaders,
        body: openaiBody,
      });
    }

    if (!response.ok) {
      console.error(`OpenAI API returned status ${response.status}`, await response.text());
      throw new Error(`OpenAI API failed with status ${response.status}`);
    }

    const openaiData = await response.json();
    const message = openaiData.output?.find((o: { type: string }) => o.type === 'message');
    const candidateText = message?.content?.find((c: { type: string }) => c.type === 'output_text')?.text;

    if (!candidateText) {
      throw new Error('No candidate response returned from OpenAI.');
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
    // Graceful fallback to rule-based parser in case of OpenAI API error
    const parsedData = parseTextFallback(text);
    return new Response(JSON.stringify(parsedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
