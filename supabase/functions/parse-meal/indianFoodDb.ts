// Curated composite-dish nutrition data for common Indian foods, sourced from the
// Indian Nutrient Databank (INDB) — built from ICMR-NIN's Indian Food Composition
// Tables 2017 plus standard recipes from published Indian cookbooks.
// https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
//
// Checked before Gemini so common Indian dishes get fixed, consistent macros
// instead of a fresh LLM estimate every time. Values are per 100g edible portion.
export interface FoodDbEntry {
  cal: number;
  pro: number;
  carb: number;
  fat: number;
  fib: number;
  defaultGrams: number;
  isCountable?: boolean;
}

export const indianFoodDb: Record<string, FoodDbEntry> = {
  // Breakfast
  idli: { cal: 137.5, pro: 4.6, carb: 28.2, fat: 0.3, fib: 2.3, defaultGrams: 35, isCountable: true },
  'masala dosa': { cal: 164.6, pro: 3.3, carb: 19.6, fat: 7.8, fib: 2.5, defaultGrams: 120, isCountable: true },
  'plain dosa': { cal: 380.9, pro: 10.3, carb: 64.1, fat: 8.4, fib: 5.2, defaultGrams: 80, isCountable: true },
  uttapam: { cal: 255.9, pro: 6.2, carb: 36.3, fat: 9, fib: 4.4, defaultGrams: 100, isCountable: true },
  poha: { cal: 294.5, pro: 6.1, carb: 35, fat: 14.1, fib: 3.7, defaultGrams: 150 },
  upma: { cal: 147.9, pro: 3.3, carb: 16.3, fat: 7.5, fib: 3.2, defaultGrams: 150 },
  'medu vada': { cal: 745.5, pro: 4.4, carb: 9.7, fat: 76.3, fib: 2.3, defaultGrams: 40, isCountable: true },
  pesarattu: { cal: 286, pro: 12.3, carb: 31.9, fat: 11.7, fib: 6, defaultGrams: 90, isCountable: true },

  // Rice dishes
  'plain pulao': { cal: 140.2, pro: 2.3, carb: 21.8, fat: 4.6, fib: 1.7, defaultGrams: 200 },
  'vegetable pulao': { cal: 113, pro: 2.7, carb: 17.5, fat: 3.3, fib: 2.7, defaultGrams: 200 },
  'chicken pulao': { cal: 108.2, pro: 6.1, carb: 11.2, fat: 8.5, fib: 1.6, defaultGrams: 250 },
  'mutton pulao': { cal: 130.8, pro: 6.5, carb: 11.3, fat: 10.8, fib: 1.7, defaultGrams: 250 },
  'mutton biryani': { cal: 190.8, pro: 7.4, carb: 22.5, fat: 7.7, fib: 2.4, defaultGrams: 300 },
  'vegetable biryani': { cal: 174.6, pro: 3.2, carb: 18.6, fat: 9.5, fib: 3.3, defaultGrams: 300 },
  'curd rice': { cal: 195.7, pro: 5.8, carb: 32.9, fat: 4.3, fib: 2.1, defaultGrams: 200 },
  'jeera pulao': { cal: 135.2, pro: 2.5, carb: 23.6, fat: 3.2, fib: 1.4, defaultGrams: 200 },
  khichdi: { cal: 143.2, pro: 5.6, carb: 19.6, fat: 4.5, fib: 2.5, defaultGrams: 200 },

  // Breads
  chapati: { cal: 202.3, pro: 5.9, carb: 35.6, fat: 3.6, fib: 6.3, defaultGrams: 40, isCountable: true },
  'plain paratha': { cal: 298.3, pro: 5.1, carb: 30.7, fat: 16.9, fib: 5.4, defaultGrams: 60, isCountable: true },
  'aloo paratha': { cal: 205, pro: 3.7, carb: 23.9, fat: 10.2, fib: 4.2, defaultGrams: 90, isCountable: true },
  naan: { cal: 286.4, pro: 8.1, carb: 51.8, fat: 5, fib: 1.9, defaultGrams: 90, isCountable: true },
  poori: { cal: 737.6, pro: 1.4, carb: 8.2, fat: 77.6, fib: 1.5, defaultGrams: 25, isCountable: true },
  bhatura: { cal: 793.2, pro: 1.6, carb: 10.7, fat: 82.6, fib: 0.4, defaultGrams: 80, isCountable: true },
  'makki ki roti': { cal: 264, pro: 3.5, carb: 24.2, fat: 16.8, fib: 5.2, defaultGrams: 50, isCountable: true },

  // Dals and curries
  sambar: { cal: 96.9, pro: 3.4, carb: 10.6, fat: 4.4, fib: 3.5, defaultGrams: 150 },
  rajma: { cal: 143.7, pro: 6, carb: 16.4, fat: 5.8, fib: 5.8, defaultGrams: 200 },
  'dal makhani': { cal: 74, pro: 3.3, carb: 8, fat: 3.1, fib: 2.3, defaultGrams: 200 },
  'chana dal': { cal: 99.7, pro: 4.2, carb: 10, fat: 4.6, fib: 3.7, defaultGrams: 200 },
  chole: { cal: 163.4, pro: 6.1, carb: 20, fat: 6.8, fib: 4.7, defaultGrams: 200 },
  'palak paneer': { cal: 77.7, pro: 4, carb: 4.4, fat: 4.8, fib: 1.9, defaultGrams: 200 },
  'matar paneer': { cal: 134.8, pro: 6.6, carb: 9.3, fat: 7.8, fib: 3.3, defaultGrams: 200 },
  'paneer curry': { cal: 176.5, pro: 7.8, carb: 8.4, fat: 12.4, fib: 1.4, defaultGrams: 200 },
  'chicken curry': { cal: 129.2, pro: 11.8, carb: 3.4, fat: 7.6, fib: 1.4, defaultGrams: 200 },
  'chicken korma': { cal: 148, pro: 9.8, carb: 5.4, fat: 9.7, fib: 1.8, defaultGrams: 200 },
  'mutton korma': { cal: 115.6, pro: 7.1, carb: 2.5, fat: 8.5, fib: 0.8, defaultGrams: 200 },
  'fish curry': { cal: 111.1, pro: 8.8, carb: 3.8, fat: 6.7, fib: 1.9, defaultGrams: 200 },
  'egg curry': { cal: 117.5, pro: 5.4, carb: 4, fat: 8.8, fib: 2.1, defaultGrams: 200 },
  'aloo curry': { cal: 89.6, pro: 1.5, carb: 10.4, fat: 4.5, fib: 2.4, defaultGrams: 200 },
  rasam: { cal: 26.7, pro: 1.1, carb: 3.4, fat: 0.9, fib: 1.6, defaultGrams: 150 },
  'aloo matar': { cal: 100.9, pro: 3.5, carb: 9.7, fat: 5.1, fib: 3.6, defaultGrams: 200 },

  // Snacks
  'vegetable samosa': { cal: 443.1, pro: 2.2, carb: 13.2, fat: 42.2, fib: 1.5, defaultGrams: 50, isCountable: true },
  'aloo samosa': { cal: 577.4, pro: 1.7, carb: 9.2, fat: 59.2, fib: 1.2, defaultGrams: 50, isCountable: true },
  'onion pakora': { cal: 674.6, pro: 1.9, carb: 5.4, fat: 71.8, fib: 1.1, defaultGrams: 80 },
  'vegetable cutlet': { cal: 665.5, pro: 1.2, carb: 4.7, fat: 71.3, fib: 0.9, defaultGrams: 60, isCountable: true },
  kachori: { cal: 712.7, pro: 2.5, carb: 12.8, fat: 72.3, fib: 1, defaultGrams: 45, isCountable: true },

  // Sweets
  'gulab jamun': { cal: 471.2, pro: 0.9, carb: 28.2, fat: 40.2, fib: 0, defaultGrams: 40, isCountable: true },
  'besan ladoo': { cal: 476.9, pro: 8.9, carb: 62.6, fat: 22.8, fib: 4.4, defaultGrams: 25, isCountable: true },
  'rice kheer': { cal: 75, pro: 2.3, carb: 10, fat: 3, fib: 0.2, defaultGrams: 150 },
  'suji halwa': { cal: 225.6, pro: 2.2, carb: 24.7, fat: 13.4, fib: 1.9, defaultGrams: 100 },
  'gajar halwa': { cal: 172.6, pro: 3.1, carb: 18.5, fat: 9.7, fib: 2.7, defaultGrams: 100 },
  'moong dal halwa': { cal: 349.8, pro: 8.4, carb: 40.2, fat: 17.7, fib: 2.6, defaultGrams: 100 },
};
