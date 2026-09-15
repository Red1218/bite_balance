// One-time (re-runnable) import of common Indian fruits/vegetables/staples into
// `indian_foods`, sourced from USDA FoodData Central (public domain, CC0 --
// https://fdc.nal.usda.gov/). USDA has no "Indian foods" bulk export, so this
// works from a curated seed list below rather than transforming one big file.
//
// Run with:
//   node --env-file=.env --experimental-strip-types scripts/import-usda-foods.ts
//
// Requires in .env:
//   VITE_SUPABASE_URL           (already present)
//   SUPABASE_SERVICE_ROLE_KEY   (bypasses RLS for bulk system-owned rows)
//   USDA_FDC_API_KEY            (free key: https://api.data.gov/signup/)

import { createClient } from '@supabase/supabase-js';

interface SeedFood {
  name: string;
  query: string;
  category: string;
}

// ponytail: a curated ~150-item seed list, not an exhaustive catalog -- India-specific
// items with no USDA match (ridge gourd, ash gourd, jamun, amla, ...) are skipped and
// logged, not hand-entered here. Extend this list later if specific gaps matter.
const SEED_FOODS: SeedFood[] = [
  // Fruits
  { name: 'Banana', query: 'banana, raw', category: 'fruits' },
  { name: 'Mango', query: 'mango, raw', category: 'fruits' },
  { name: 'Apple', query: 'apple, raw, with skin', category: 'fruits' },
  { name: 'Papaya', query: 'papaya, raw', category: 'fruits' },
  { name: 'Guava', query: 'guavas, common, raw', category: 'fruits' },
  { name: 'Pomegranate', query: 'pomegranates, raw', category: 'fruits' },
  { name: 'Watermelon', query: 'watermelon, raw', category: 'fruits' },
  { name: 'Muskmelon', query: 'melons, cantaloupe, raw', category: 'fruits' },
  { name: 'Orange', query: 'oranges, raw, all commercial varieties', category: 'fruits' },
  { name: 'Sweet Lime (Mosambi)', query: 'lime, raw', category: 'fruits' },
  { name: 'Grapes', query: 'grapes, red or green', category: 'fruits' },
  { name: 'Pineapple', query: 'pineapple, raw, all varieties', category: 'fruits' },
  { name: 'Jackfruit', query: 'jackfruit, raw', category: 'fruits' },
  { name: 'Custard Apple (Sitaphal)', query: 'sugar apples sweetsop raw', category: 'fruits' },
  { name: 'Chikoo (Sapota)', query: 'sapodilla, raw', category: 'fruits' },
  { name: 'Lychee', query: 'litchis, raw', category: 'fruits' },
  { name: 'Fig', query: 'figs, raw', category: 'fruits' },
  { name: 'Dates', query: 'dates, medjool', category: 'fruits' },
  { name: 'Coconut', query: 'nuts, coconut meat, raw', category: 'fruits' },
  { name: 'Strawberry', query: 'strawberries, raw', category: 'fruits' },
  { name: 'Kiwi', query: 'kiwifruit, green, raw', category: 'fruits' },
  { name: 'Pear', query: 'pears, raw', category: 'fruits' },
  { name: 'Peach', query: 'peaches, raw', category: 'fruits' },
  { name: 'Plum', query: 'plums, raw', category: 'fruits' },
  { name: 'Apricot', query: 'apricots, raw', category: 'fruits' },

  // Vegetables
  { name: 'Potato', query: 'potatoes, raw, skin', category: 'vegetables' },
  { name: 'Onion', query: 'onions, raw', category: 'vegetables' },
  { name: 'Tomato', query: 'tomatoes, red, ripe, raw', category: 'vegetables' },
  { name: 'Brinjal (Eggplant)', query: 'eggplant, raw', category: 'vegetables' },
  { name: 'Okra (Bhindi)', query: 'okra, raw', category: 'vegetables' },
  { name: 'Bitter Gourd (Karela)', query: 'balsam-pear (bitter gourd), pods, raw', category: 'vegetables' },
  { name: 'Bottle Gourd (Lauki)', query: 'gourd calabash raw', category: 'vegetables' },
  { name: 'Snake Gourd', query: 'gourd, dishcloth (towel gourd), raw', category: 'vegetables' },
  { name: 'Pumpkin', query: 'pumpkin, raw', category: 'vegetables' },
  { name: 'Cauliflower', query: 'cauliflower, raw', category: 'vegetables' },
  { name: 'Cabbage', query: 'cabbage, raw', category: 'vegetables' },
  { name: 'Carrot', query: 'carrots, raw', category: 'vegetables' },
  { name: 'Beetroot', query: 'beets, raw', category: 'vegetables' },
  { name: 'Radish', query: 'radishes, raw', category: 'vegetables' },
  { name: 'Green Beans (French Beans)', query: 'beans, snap, green, raw', category: 'vegetables' },
  { name: 'Broad Beans', query: 'broadbeans fava beans mature seeds raw', category: 'vegetables' },
  { name: 'Green Peas', query: 'peas, green, raw', category: 'vegetables' },
  { name: 'Spinach (Palak)', query: 'spinach, raw', category: 'vegetables' },
  { name: 'Fenugreek Leaves (Methi)', query: 'fenugreek leaves, raw', category: 'vegetables' },
  { name: 'Amaranth Leaves (Chaulai)', query: 'amaranth leaves, raw', category: 'vegetables' },
  { name: 'Mustard Greens (Sarson)', query: 'mustard greens, raw', category: 'vegetables' },
  { name: 'Coriander Leaves', query: 'coriander leaves cilantro raw', category: 'vegetables' },
  { name: 'Mint Leaves', query: 'mint, spearmint, fresh', category: 'vegetables' },
  { name: 'Drumstick (Moringa)', query: 'drumstick pods, raw', category: 'vegetables' },
  { name: 'Drumstick Leaves', query: 'drumstick leaves, raw', category: 'vegetables' },
  { name: 'Colocasia (Arbi/Taro)', query: 'taro leaves, raw', category: 'vegetables' },
  { name: 'Yam', query: 'yam, raw', category: 'vegetables' },
  { name: 'Sweet Potato', query: 'sweet potato, raw, unprepared', category: 'vegetables' },
  { name: 'Capsicum (Bell Pepper)', query: 'peppers, sweet, green, raw', category: 'vegetables' },
  { name: 'Green Chili', query: 'peppers, hot chile, green, raw', category: 'vegetables' },
  { name: 'Cucumber', query: 'cucumber, with peel, raw', category: 'vegetables' },
  { name: 'Lettuce', query: 'lettuce, raw', category: 'vegetables' },
  { name: 'Spring Onion', query: 'onions, spring or scallions, raw', category: 'vegetables' },
  { name: 'Garlic', query: 'garlic, raw', category: 'vegetables' },
  { name: 'Ginger', query: 'ginger root, raw', category: 'vegetables' },
  { name: 'Turnip', query: 'turnips, raw', category: 'vegetables' },
  { name: 'Raw Banana (Plantain)', query: 'plantains, raw', category: 'vegetables' },
  { name: 'Sweet Corn', query: 'corn, sweet, yellow, raw', category: 'vegetables' },
  { name: 'Mushroom', query: 'mushrooms, white, raw', category: 'vegetables' },

  // Grains, millets and pulses
  { name: 'Rice (Raw)', query: 'rice, white, long-grain, raw, unenriched', category: 'rice_grains' },
  { name: 'Wheat Flour (Atta)', query: 'wheat flour, whole-grain', category: 'rice_grains' },
  { name: 'Pearl Millet (Bajra)', query: 'millet, raw', category: 'rice_grains' },
  { name: 'Sorghum (Jowar)', query: 'sorghum grain', category: 'rice_grains' },
  { name: 'Finger Millet (Ragi)', query: 'finger millet, raw', category: 'rice_grains' },
  { name: 'Semolina (Sooji/Rava)', query: 'semolina, enriched', category: 'rice_grains' },
  { name: 'Poha (Flattened Rice)', query: 'rice, white, glutinous, unenriched, raw', category: 'rice_grains' },
  { name: 'Oats', query: 'oats, raw', category: 'rice_grains' },
  { name: 'Barley', query: 'barley, pearled, raw', category: 'rice_grains' },
  { name: 'Chickpeas (Chana)', query: 'chickpeas garbanzo beans mature seeds raw', category: 'rice_grains' },
  { name: 'Kidney Beans (Rajma)', query: 'beans, kidney, red, mature seeds, raw', category: 'rice_grains' },
  { name: 'Black Gram (Urad Dal)', query: 'mothbeans, mature seeds, raw', category: 'rice_grains' },
  { name: 'Green Gram (Moong Dal)', query: 'mung beans, mature seeds, raw', category: 'rice_grains' },
  { name: 'Pigeon Peas (Toor Dal)', query: 'pigeon peas red gram mature seeds raw', category: 'rice_grains' },
  { name: 'Lentils (Masoor Dal)', query: 'lentils, raw', category: 'rice_grains' },
  { name: 'Black-eyed Peas (Lobia)', query: 'cowpeas blackeyes immature seeds raw', category: 'rice_grains' },
  { name: 'Soybean', query: 'soybeans, mature seeds, raw', category: 'rice_grains' },
  { name: 'Peanuts (Groundnut)', query: 'peanuts, raw', category: 'rice_grains' },
  { name: 'Split Peas', query: 'peas, split, mature seeds, raw', category: 'rice_grains' },

  // Dairy and eggs
  { name: 'Milk (Whole, Cow)', query: 'milk, whole, 3.25% milkfat', category: 'dairy' },
  { name: 'Curd (Yogurt)', query: 'yogurt, plain, whole milk', category: 'dairy' },
  { name: 'Paneer', query: 'cheese, cottage, creamed, large or small curd', category: 'dairy' },
  { name: 'Ghee', query: 'ghee, clarified butter', category: 'dairy' },
  { name: 'Butter', query: 'butter, salted', category: 'dairy' },
  { name: 'Cheese (Cheddar)', query: 'cheese, cheddar', category: 'dairy' },
  { name: 'Buttermilk (Chaas)', query: 'buttermilk, fluid, whole milk', category: 'dairy' },
  { name: 'Cream', query: 'cream, fluid, heavy whipping', category: 'dairy' },
  { name: 'Egg (Whole, Chicken)', query: 'egg, whole, raw, fresh', category: 'eggs' },
  { name: 'Egg White', query: 'egg, white, raw, fresh', category: 'eggs' },

  // Meat, chicken and seafood
  { name: 'Chicken Breast', query: 'chicken, broilers or fryers, breast, meat only, raw', category: 'chicken' },
  { name: 'Chicken Leg', query: 'chicken, broilers or fryers, leg, meat only, raw', category: 'chicken' },
  { name: 'Mutton (Goat Meat)', query: 'goat, raw', category: 'meat' },
  { name: 'Lamb', query: 'lamb, raw, ground', category: 'meat' },
  { name: 'Pork', query: 'pork, fresh, ground, raw', category: 'meat' },
  { name: 'Beef', query: 'beef, ground, raw', category: 'meat' },
  { name: 'Fish (Rohu/Freshwater)', query: 'fish, freshwater, mixed species, raw', category: 'seafood' },
  { name: 'Prawns/Shrimp', query: 'shrimp, raw', category: 'seafood' },
  { name: 'Crab', query: 'crab, blue, raw', category: 'seafood' },
  { name: 'Tuna', query: 'fish, tuna, fresh, raw', category: 'seafood' },
  { name: 'Salmon', query: 'fish, salmon, raw', category: 'seafood' },

  // Nuts, seeds, spices, sweeteners
  { name: 'Almonds', query: 'nuts, almonds, raw', category: 'snacks' },
  { name: 'Cashew Nuts', query: 'nuts, cashew nuts, raw', category: 'snacks' },
  { name: 'Walnuts', query: 'nuts, walnuts, english, raw', category: 'snacks' },
  { name: 'Pistachios', query: 'nuts, pistachio nuts, raw', category: 'snacks' },
  { name: 'Sesame Seeds', query: 'seeds, sesame seeds, whole, raw', category: 'snacks' },
  { name: 'Sunflower Seeds', query: 'seeds, sunflower seed kernels, raw', category: 'snacks' },
  { name: 'Flax Seeds', query: 'seeds, flaxseed, raw', category: 'snacks' },
  { name: 'Desiccated Coconut', query: 'coconut meat dried desiccated not sweetened', category: 'snacks' },
  { name: 'Jaggery', query: 'sugars, brown', category: 'snacks' },
  { name: 'Sugar', query: 'sugars, granulated', category: 'snacks' },
  { name: 'Honey', query: 'honey', category: 'snacks' },
  { name: 'Turmeric', query: 'spices, turmeric, ground', category: 'snacks' },
  { name: 'Cumin Seeds', query: 'spices, cumin seed', category: 'snacks' },
  { name: 'Coriander Seeds', query: 'spices, coriander seed', category: 'snacks' },
  { name: 'Mustard Seeds', query: 'spices, mustard seed, ground', category: 'snacks' },
  { name: 'Black Pepper', query: 'spices, pepper, black', category: 'snacks' },
  { name: 'Cardamom', query: 'spices, cardamom', category: 'snacks' },
  { name: 'Cinnamon', query: 'spices, cinnamon, ground', category: 'snacks' },
  { name: 'Cloves', query: 'spices, cloves, ground', category: 'snacks' },
  { name: 'Tamarind', query: 'tamarinds, raw', category: 'snacks' },

  // Beverages
  { name: 'Tea (Brewed)', query: 'tea, black, brewed', category: 'beverages' },
  { name: 'Coffee (Brewed)', query: 'coffee, brewed, prepared with tap water', category: 'beverages' },
  { name: 'Coconut Water', query: 'nuts, coconut water (liquid from coconuts)', category: 'beverages' },
  { name: 'Orange Juice', query: 'orange juice', category: 'beverages' },
  { name: 'Apple Juice', query: 'apple juice, canned or bottled, unsweetened, without added ascorbic acid', category: 'beverages' },
];

// USDA nutrient name -> indian_foods column, and the unit each value is reported in
// (Foundation/SR Legacy nutrient values are per 100g, matching this app's convention).
const NUTRIENT_MAP: Record<string, string> = {
  'Protein': 'protein',
  'Total lipid (fat)': 'fat',
  'Carbohydrate, by difference': 'carbs',
  'Fiber, total dietary': 'fiber',
  'Vitamin C, total ascorbic acid': 'vitamin_c',
  'Vitamin D (D2 + D3)': 'vitamin_d',
  'Vitamin B-12': 'vitamin_b12',
  'Iron, Fe': 'iron',
  'Calcium, Ca': 'calcium',
  'Potassium, K': 'potassium',
  'Sodium, Na': 'sodium',
  'Magnesium, Mg': 'magnesium',
  'Zinc, Zn': 'zinc',
};

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USDA_API_KEY = process.env.USDA_FDC_API_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USDA_API_KEY) {
  console.error(
    'Missing required env vars. Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and USDA_FDC_API_KEY in .env.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface UsdaNutrient {
  nutrientName: string;
  unitName: string;
  value: number;
}

interface UsdaFood {
  description: string;
  foodNutrients: UsdaNutrient[];
}

async function searchUsda(query: string): Promise<UsdaFood | null> {
  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', query);
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  url.searchParams.set('pageSize', '1');
  url.searchParams.set('api_key', USDA_API_KEY!);

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  USDA request failed (${res.status}) for "${query}"`);
    return null;
  }
  const data = await res.json();
  const match = data.foods?.[0] ?? null;

  // USDA's search silently returns an unrelated alphabetical list instead of an
  // empty one when the phrase doesn't really match anything in the filtered
  // dataType set (confirmed: "honey, raw" -> "Abiyuch, raw" as the "top hit").
  // Reject anything that doesn't actually contain the words we searched for.
  if (match && !isPlausibleMatch(query, match.description)) {
    console.warn(`  rejected implausible match for "${query}": "${match.description}"`);
    return null;
  }
  return match;
}

function isPlausibleMatch(query: string, description: string): boolean {
  const words = query.split(',')[0].toLowerCase().match(/[a-z]+/g) ?? [];
  const desc = description.toLowerCase();
  return words.length > 0 && words.every((w) => desc.includes(w));
}

const ENERGY_KCAL_NAMES = ['Energy', 'Energy (Atwater General Factors)', 'Energy (Atwater Specific Factors)'];

function extractNutrients(food: UsdaFood) {
  // USDA lists Energy twice per food -- once in kcal, once in kJ. Grabbing
  // whichever came first silently inflated calories ~4.2x for foods where the
  // kJ entry led (confirmed: "Bananas, raw" -> 371 kJ stored as if it were 371 kcal).
  // Foundation-dataset foods (newer USDA methodology) also name it differently
  // than SR Legacy ("Energy (Atwater General Factors)" instead of plain "Energy") --
  // confirmed: this silently zeroed calories for Apple, Rice, and all nuts/seeds.
  const energy = ENERGY_KCAL_NAMES.map((name) =>
    food.foodNutrients.find((n) => n.nutrientName === name && n.unitName === 'KCAL')
  ).find(Boolean);
  const out: Record<string, number> = { calories: energy?.value ?? 0 };
  for (const [usdaName, column] of Object.entries(NUTRIENT_MAP)) {
    const match = food.foodNutrients.find((n) => n.nutrientName === usdaName);
    out[column] = match?.value ?? 0;
  }
  return out;
}

async function main() {
  let inserted = 0;
  let skipped = 0;
  const skippedNames: string[] = [];

  for (const seed of SEED_FOODS) {
    const match = await searchUsda(seed.query);
    if (!match) {
      skipped++;
      skippedNames.push(seed.name);
      console.log(`skip: ${seed.name} (no USDA match for "${seed.query}")`);
      continue;
    }

    const nutrients = extractNutrients(match);
    const payload = {
      name: seed.name,
      category: seed.category,
      serving_size: 100,
      serving_unit: 'g',
      is_verified: true,
      user_id: null,
      ...nutrients,
    };

    // Supabase's upsert always issues a plain ON CONFLICT(name), which Postgres can't
    // match against the partial unique index (WHERE is_verified = true) from Task 1 --
    // so upsert unconditionally 404s. Select-then-insert/update instead.
    const { data: existing } = await supabase
      .from('indian_foods')
      .select('id')
      .eq('is_verified', true)
      .ilike('name', seed.name)
      .maybeSingle();

    const { error } = existing
      ? await supabase.from('indian_foods').update(payload).eq('id', existing.id)
      : await supabase.from('indian_foods').insert(payload);

    if (error) {
      console.warn(`  failed to upsert "${seed.name}":`, error.message);
      skipped++;
      skippedNames.push(seed.name);
      continue;
    }

    inserted++;
    console.log(`ok:   ${seed.name} <- USDA "${match.description}"`);

    // ponytail: fixed 150ms delay between calls, not a real rate limiter --
    // fine at this seed-list size (well under a registered key's 1000/hr), upgrade
    // only if the seed list grows into the thousands.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\nDone. ${inserted} upserted, ${skipped} skipped.`);
  if (skippedNames.length > 0) {
    console.log('Skipped:', skippedNames.join(', '));
  }
}

main();
