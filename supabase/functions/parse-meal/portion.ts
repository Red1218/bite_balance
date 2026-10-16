// How much of a matched food the user's text describes. Pure (no Deno/Supabase), so
// portion.check.ts can run it under plain Node.

export const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

// "3 eggs" / "two idli" -> 3 / 2; null when the text has no count.
export const parseCount = (text: string): number | null => {
  const m = text.toLowerCase().match(new RegExp(`\\b(\\d+(?:\\.\\d+)?|${NUMBER_WORDS.join('|')})\\b`));
  if (!m) return null;
  const n = NUMBER_WORDS.indexOf(m[1]) + 1 || parseFloat(m[1]);
  return n > 0 && n <= 50 ? n : null;
};

export const parseWeightGrams = (text: string): number | null => {
  const match = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(g|grams|gram|oz|ounces|ounce)/i);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return match[2].toLowerCase().startsWith('oz') ? val * 28.35 : val;
};

export interface FoodPortion {
  serving_size: number | string | null;
  serving_unit: string | null;
  user_id: string | null;
}

// Multiplier for the food's stored nutrients.
// - Built-in foods store nutrients per 100 g; serving_size is the grams in one piece.
// - The user's own foods store nutrients per serving of `serving_size serving_unit`
//   (e.g. 3 eggs, 60 g), so they scale by servings: grams against a gram serving, a count
//   of units against the serving's count, and anything else is one serving.
export const portionFactor = (text: string, food: FoodPortion): number => {
  const size = Number(food.serving_size) || 0;
  const grams = parseWeightGrams(text);
  const count = parseCount(text);
  if (!food.user_id) return (grams ?? (size || 100) * (count ?? 1)) / 100;

  const per = size || 1;
  if (/^g(rams?)?$/i.test(food.serving_unit ?? '')) return grams !== null ? grams / per : count ?? 1;
  if (grams !== null) return 1;
  return count !== null ? count / per : 1;
};

// The amount the scaled nutrients cover, for the Portion box: "2 eggs", "120 g".
// Built-in foods are per 100 g; the user's own foods are per `serving_size serving_unit`.
export const portionOf = (factor: number, food: FoodPortion): { amount: number; unit: string } => {
  const own = !!food.user_id;
  const base = own ? Number(food.serving_size) || 1 : 100;
  const unit = own ? (food.serving_unit || 'serving').trim() : 'g';
  return { amount: Math.round(factor * base * 10) / 10, unit: /^g(rams?)?$/i.test(unit) ? 'g' : unit };
};
