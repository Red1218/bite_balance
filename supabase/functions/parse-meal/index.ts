import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

// Simple rule-based parser fallback when API key is missing
const parseTextFallback = (text: string): ParseResponse => {
  const lower = text.toLowerCase();
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;

  // Extract quantity if present (e.g. "2 eggs" -> count=2)
  const getCount = (itemName: string): number => {
    const regex = new RegExp(`(\\d+)\\s+${itemName}`);
    const match = lower.match(regex);
    return match ? parseInt(match[1]) : 1;
  };

  let matched = false;

  if (lower.includes('egg')) {
    const count = getCount('egg');
    calories += count * 70;
    protein += count * 6;
    fat += count * 5;
    matched = true;
  }
  if (lower.includes('banana')) {
    const count = getCount('banana');
    calories += count * 105;
    protein += count * 1.3;
    carbs += count * 27;
    fiber += count * 3;
    matched = true;
  }
  if (lower.includes('milk')) {
    const count = getCount('milk');
    calories += count * 120;
    protein += count * 8;
    carbs += count * 12;
    fat += count * 5;
    matched = true;
  }
  if (lower.includes('chicken')) {
    const count = getCount('chicken');
    calories += count * 165;
    protein += count * 31;
    fat += count * 3.6;
    matched = true;
  }
  if (lower.includes('apple')) {
    const count = getCount('apple');
    calories += count * 95;
    protein += count * 0.5;
    carbs += count * 25;
    fiber += count * 4.4;
    matched = true;
  }
  if (lower.includes('oatmeal') || lower.includes('oats')) {
    calories += 150;
    protein += 5;
    carbs += 27;
    fat += 2.5;
    fiber += 4;
    matched = true;
  }
  if (lower.includes('bread') || lower.includes('toast')) {
    const count = getCount('bread') || getCount('toast') || 1;
    calories += count * 75;
    protein += count * 3;
    carbs += count * 15;
    fat += count * 1;
    fiber += count * 2;
    matched = true;
  }
  if (lower.includes('salad')) {
    calories += 150;
    protein += 3;
    carbs += 10;
    fat += 10;
    fiber += 3;
    matched = true;
  }

  if (!matched) {
    // Return standard estimate if unrecognized
    return {
      name: text,
      calories: 350,
      protein: 12,
      carbs: 45,
      fat: 10,
      fiber: 2,
    };
  }

  return {
    name: text,
    calories,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || text.trim().length < 3) {
      return new Response(
        JSON.stringify({ error: 'Text prompt must be at least 3 characters long.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Parsing meal text: "${text}"`);

    // Retrieve Gemini API Key from Supabase / environment variable
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_KEY');

    if (!geminiKey) {
      console.warn('GEMINI_API_KEY environment variable is not set. Using rule-based fallback parser.');
      const parsedData = parseTextFallback(text);
      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call Gemini API to parse natural language meal details to JSON format
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

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
    // Graceful fallback to rule-based parser in case of Deno fetch/Gemini API error
    try {
      const { text } = await req.json();
      const parsedData = parseTextFallback(text);
      return new Response(JSON.stringify(parsedData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(
        JSON.stringify({ error: error.message || 'Failed to parse meal description' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
});
