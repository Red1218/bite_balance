import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { FoodDbEntry, indianFoodDb } from '../_shared/indianFoodDb.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface ParseResponse {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

// Matches food names from `db` in `text`, parsing an explicit weight ("150g") or
// count ("2 eggs") per match and summing across every matched item. Shared by the
// curated Indian dish lookup and the generic rule-based fallback below.
const matchFoodDatabase = (text: string, db: Record<string, FoodDbEntry>): ParseResponse | null => {
  const lower = text.toLowerCase();

  // Try to parse weight (e.g., "150g", "200 grams", "3 ounces", "2.5 oz")
  const weightRegex = /(\d+(?:\.\d+)?)\s*(g|grams|gram|oz|ounces|ounce)/gi;
  let parsedWeightGrams: number | null = null;
  const weightMatch = weightRegex.exec(lower);
  if (weightMatch) {
    const val = parseFloat(weightMatch[1]);
    const unit = weightMatch[2].toLowerCase();
    parsedWeightGrams = unit.startsWith('oz') ? val * 28.35 : val;
  }

  // Try to parse count (e.g., "2 eggs", "3 bananas", "1 slice of bread")
  const getCount = (itemName: string): number => {
    const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const numberRegex = new RegExp(`(\\d+|one|two|three|four|five|six|seven|eight|nine|ten)\\s+${itemName}`, 'i');
    const match = lower.match(numberRegex);
    if (match) {
      const val = match[1].toLowerCase();
      const numVal = parseInt(val);
      if (!isNaN(numVal)) return numVal;
      const wordIdx = words.indexOf(val);
      if (wordIdx !== -1) return wordIdx + 1;
    }
    return 1;
  };

  let matched = false;
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;

  // Match items in database
  for (const [key, info] of Object.entries(db)) {
    if (lower.includes(key)) {
      matched = true;
      let targetGrams = info.defaultGrams;

      if (parsedWeightGrams !== null) {
        targetGrams = parsedWeightGrams;
      } else if (info.isCountable) {
        const count = getCount(key);
        targetGrams = count * info.defaultGrams;
      }

      const factor = targetGrams / 100;

      calories += info.cal * factor;
      protein += info.pro * factor;
      carbs += info.carb * factor;
      fat += info.fat * factor;
      fiber += info.fib * factor;
    }
  }

  if (!matched) return null;

  return {
    name: text.charAt(0).toUpperCase() + text.slice(1),
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  };
};

// Simple rule-based parser fallback when both the Indian dish DB and Gemini miss
const parseTextFallback = (text: string): ParseResponse => {
  // Database of standard foods per 100g
  const foodDatabase: Record<string, FoodDbEntry> = {
    chicken: { cal: 165, pro: 31, carb: 0, fat: 3.6, fib: 0, defaultGrams: 150 },
    turkey: { cal: 135, pro: 30, carb: 0, fat: 1.5, fib: 0, defaultGrams: 150 },
    beef: { cal: 250, pro: 26, carb: 0, fat: 15, fib: 0, defaultGrams: 150 },
    steak: { cal: 252, pro: 27, carb: 0, fat: 15, fib: 0, defaultGrams: 200 },
    pork: { cal: 242, pro: 27, carb: 0, fat: 14, fib: 0, defaultGrams: 150 },
    salmon: { cal: 208, pro: 20, carb: 0, fat: 13, fib: 0, defaultGrams: 150 },
    fish: { cal: 150, pro: 20, carb: 0, fat: 7, fib: 0, defaultGrams: 150 },
    tuna: { cal: 130, pro: 28, carb: 0, fat: 1, fib: 0, defaultGrams: 100 },
    egg: { cal: 140, pro: 12, carb: 1.2, fat: 10, fib: 0, defaultGrams: 50, isCountable: true },
    banana: { cal: 89, pro: 1.1, carb: 22.8, fat: 0.3, fib: 2.6, defaultGrams: 120, isCountable: true },
    milk: { cal: 50, pro: 3.3, carb: 4.8, fat: 2.0, fib: 0, defaultGrams: 244 },
    yogurt: { cal: 63, pro: 5.3, carb: 7.0, fat: 1.6, fib: 0, defaultGrams: 150 },
    apple: { cal: 52, pro: 0.3, carb: 14, fat: 0.2, fib: 2.4, defaultGrams: 180, isCountable: true },
    oats: { cal: 389, pro: 16.9, carb: 66.3, fat: 6.9, fib: 10.6, defaultGrams: 40 },
    oatmeal: { cal: 389, pro: 16.9, carb: 66.3, fat: 6.9, fib: 10.6, defaultGrams: 40 },
    bread: { cal: 265, pro: 9, carb: 49, fat: 3.2, fib: 2.7, defaultGrams: 30, isCountable: true },
    toast: { cal: 265, pro: 9, carb: 49, fat: 3.2, fib: 2.7, defaultGrams: 30, isCountable: true },
    salad: { cal: 15, pro: 1.4, carb: 2.9, fat: 0.2, fib: 1.3, defaultGrams: 150 },
    rice: { cal: 130, pro: 2.7, carb: 28, fat: 0.3, fib: 0.4, defaultGrams: 150 },
    potato: { cal: 86, pro: 1.6, carb: 20, fat: 0.1, fib: 1.8, defaultGrams: 150 },
    potatoes: { cal: 86, pro: 1.6, carb: 20, fat: 0.1, fib: 1.8, defaultGrams: 150 },
    butter: { cal: 717, pro: 0.9, carb: 0.1, fat: 81, fib: 0, defaultGrams: 10 },
    oil: { cal: 884, pro: 0, carb: 0, fat: 100, fib: 0, defaultGrams: 14 },
    protein: { cal: 400, pro: 80, carb: 10, fat: 5, fib: 3, defaultGrams: 30 },
    roti: { cal: 266, pro: 9.3, carb: 55, fat: 1.3, fib: 7.6, defaultGrams: 30, isCountable: true },
    chapati: { cal: 266, pro: 9.3, carb: 55, fat: 1.3, fib: 7.6, defaultGrams: 30, isCountable: true },
    naan: { cal: 300, pro: 9.0, carb: 56, fat: 4.5, fib: 2.5, defaultGrams: 80, isCountable: true },
    paratha: { cal: 220, pro: 4.2, carb: 32.5, fat: 8.2, fib: 3.1, defaultGrams: 100, isCountable: true },
    biryani: { cal: 180, pro: 9.2, carb: 22.4, fat: 6.5, fib: 1.2, defaultGrams: 300 },
    paneer: { cal: 229, pro: 7.8, carb: 6.2, fat: 19.5, fib: 0.8, defaultGrams: 150 },
    dal: { cal: 110, pro: 5.2, carb: 15.4, fat: 3.5, fib: 4.2, defaultGrams: 200 },
    samosa: { cal: 349, pro: 5.4, carb: 42.9, fat: 17.6, fib: 2.7, defaultGrams: 75, isCountable: true },
    dosa: { cal: 168, pro: 3.5, carb: 30.2, fat: 3.5, fib: 1.4, defaultGrams: 80, isCountable: true },
    idli: { cal: 120, pro: 3.2, carb: 24.8, fat: 0.4, fib: 1.6, defaultGrams: 50, isCountable: true },
    chai: { cal: 61, pro: 1.6, carb: 8.3, fat: 2.1, fib: 0, defaultGrams: 150, isCountable: true },
    lassi: { cal: 92, pro: 2.4, carb: 12.1, fat: 2.9, fib: 0, defaultGrams: 200, isCountable: true },
  };

  const matched = matchFoodDatabase(text, foodDatabase);
  if (matched) return matched;

  return {
    name: text,
    calories: 350,
    protein: 12,
    carbs: 45,
    fat: 10,
    fiber: 2,
  };
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

  // Check the curated Indian dish database first — a fixed, consistent answer for
  // known dishes beats a fresh Gemini estimate that can drift between requests.
  const indianMatch = matchFoodDatabase(text, indianFoodDb);
  if (indianMatch) {
    return new Response(JSON.stringify(indianMatch), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
  "fiber": number (grams)
}
Estimate values accurately based on average food tables. Return ONLY the JSON object, do not explain your response.`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
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
      }),
    });

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
    const result: ParseResponse = {
      name: parsedJson.name || text,
      calories: Math.round(Number(parsedJson.calories) || 0),
      protein: Math.round((Number(parsedJson.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(parsedJson.carbs) || 0) * 10) / 10,
      fat: Math.round((Number(parsedJson.fat) || 0) * 10) / 10,
      fiber: Math.round((Number(parsedJson.fiber) || 0) * 10) / 10,
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
