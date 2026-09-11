import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { indianFoodDb } from '../_shared/indianFoodDb.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatMealItem {
  name: string;
  mealTime: 'breakfast' | 'lunch' | 'snack' | 'dinner';
  grams: number;
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

// Compact reference table of known-good dishes, fed to Gemini so it uses these
// exact values (scaled by grams/100) instead of guessing fresh each turn.
const buildReferenceTable = (): string => {
  const rows = Object.entries(indianFoodDb).map(([name, d]) => {
    return `${name}: cal=${d.cal} pro=${d.pro} carb=${d.carb} fat=${d.fat} fib=${d.fib} ` +
      `vitc=${d.vitc ?? 0} vitd=${d.vitd ?? 0} b12=${d.b12 ?? 0} iron=${d.iron ?? 0} ` +
      `calcium=${d.calcium ?? 0} potassium=${d.potassium ?? 0} sodium=${d.sodium ?? 0} ` +
      `magnesium=${d.magnesium ?? 0} zinc=${d.zinc ?? 0}`;
  });
  return rows.join('\n');
};

const buildSystemPrompt = (): string => `You are the meal-logging assistant inside a nutrition tracking app's chat. The user describes what they ate over a conversation -- possibly several meals, possibly out of order, possibly with more detail added over several messages.

Maintain a running list of every distinct food item mentioned across the WHOLE conversation so far, not just the latest message -- merge new items into what was already understood, never drop earlier ones unless the user corrects or removes something.

For each item determine:
- name: a short readable food name
- mealTime: one of "breakfast", "lunch", "snack", "dinner" -- infer from what the user said (explicit meal name, or time of day mentioned). If genuinely never stated for an item, default to "snack".
- grams: the portion size. Parse an explicit weight/count when given (e.g. "100g", "2 idlis" using a sensible per-piece weight). Use a reasonable default portion when not given.
- calories, protein, carbs, fat, fiber (grams), vitaminC (mg), vitaminD (mcg), vitaminB12 (mcg), iron (mg), calcium (mg), potassium (mg), sodium (mg), magnesium (mg), zinc (mg) -- all scaled to the item's grams.

Reference table of known dishes (per 100g) -- when an item matches one of these (or a close variant), use these exact values scaled by grams/100 rather than estimating fresh:
${buildReferenceTable()}

For anything not in the table, estimate reasonably from general nutrition knowledge.

Only ask a clarifying question when something would meaningfully change the estimate -- an ambiguous portion size, or a cooking method that changes fat/calories a lot (fried vs grilled). Don't ask about minor details. When you do ask, keep it short and put it in "reply", and optionally suggest 2-3 short quick-reply options in "replyOptions". When nothing needs asking, "reply" should just briefly acknowledge what was understood (e.g. mention the running total for the meal-time just touched) and "replyOptions" should be omitted or empty.

Respond with ONLY a JSON object of this exact shape, no other text:
{
  "reply": string,
  "replyOptions": string[] (optional),
  "items": [ { "name": string, "mealTime": string, "grams": number, "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "vitaminC": number, "vitaminD": number, "vitaminB12": number, "iron": number, "calcium": number, "potassium": number, "sodium": number, "magnesium": number, "zinc": number } ]
}`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(
      JSON.stringify({ error: 'messages must be a non-empty array.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('GEMINI_KEY');

  if (!geminiKey) {
    return new Response(
      JSON.stringify({ error: 'Chat is unavailable right now (missing API key).' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          responseMimeType: 'application/json',
        },
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

    const parsed = JSON.parse(candidateText.trim());

    const items: ChatMealItem[] = (Array.isArray(parsed.items) ? parsed.items : []).map((it: Partial<ChatMealItem>) => ({
      name: String(it.name || 'Item'),
      mealTime: (['breakfast', 'lunch', 'snack', 'dinner'].includes(it.mealTime as string)
        ? it.mealTime
        : 'snack') as ChatMealItem['mealTime'],
      grams: Math.round(Number(it.grams) || 100),
      calories: Math.round(Number(it.calories) || 0),
      protein: Math.round((Number(it.protein) || 0) * 10) / 10,
      carbs: Math.round((Number(it.carbs) || 0) * 10) / 10,
      fat: Math.round((Number(it.fat) || 0) * 10) / 10,
      fiber: Math.round((Number(it.fiber) || 0) * 10) / 10,
      vitaminC: Math.round((Number(it.vitaminC) || 0) * 10) / 10,
      vitaminD: Math.round((Number(it.vitaminD) || 0) * 10) / 10,
      vitaminB12: Math.round((Number(it.vitaminB12) || 0) * 10) / 10,
      iron: Math.round((Number(it.iron) || 0) * 10) / 10,
      calcium: Math.round((Number(it.calcium) || 0) * 10) / 10,
      potassium: Math.round((Number(it.potassium) || 0) * 10) / 10,
      sodium: Math.round((Number(it.sodium) || 0) * 10) / 10,
      magnesium: Math.round((Number(it.magnesium) || 0) * 10) / 10,
      zinc: Math.round((Number(it.zinc) || 0) * 10) / 10,
    }));

    return new Response(
      JSON.stringify({
        reply: String(parsed.reply || 'Got it.'),
        replyOptions: Array.isArray(parsed.replyOptions) ? parsed.replyOptions.map(String) : [],
        items,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('chat-meal error:', error);
    return new Response(
      JSON.stringify({
        error: 'Could not process that. Please try rephrasing, or enter the meal manually.',
      }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
