// Curated composite-dish nutrition data for common Indian foods, sourced from the
// Indian Nutrient Databank (INDB) — built from ICMR-NIN's Indian Food Composition
// Tables 2017 plus standard recipes from published Indian cookbooks.
// https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
//
// Shared between parse-meal (single-shot lookup, checked before Gemini so common
// dishes get fixed, consistent macros) and chat-meal (fed in as grounding
// reference text for the conversational assistant). Values are per 100g edible portion.
export interface FoodDbEntry {
  cal: number;
  pro: number;
  carb: number;
  fat: number;
  fib: number;
  defaultGrams: number;
  isCountable?: boolean;
  // Micronutrients, per 100g. Optional -- the small generic fallback table in
  // parse-meal/index.ts doesn't set these, so they default to 0 when absent.
  vitc?: number;
  vitd?: number;
  b12?: number;
  iron?: number;
  calcium?: number;
  potassium?: number;
  sodium?: number;
  magnesium?: number;
  zinc?: number;
}

export const indianFoodDb: Record<string, FoodDbEntry> = {
  // Breakfast
  idli: { cal: 137.5, pro: 4.6, carb: 28.2, fat: 0.3, fib: 2.3, defaultGrams: 35, isCountable: true, vitc: 0, vitd: 0.8, b12: 0, iron: 0.7, calcium: 8, potassium: 158.1, sodium: 100.8, magnesium: 25.4, zinc: 0.6 },
  'masala dosa': { cal: 164.6, pro: 3.3, carb: 19.6, fat: 7.8, fib: 2.5, defaultGrams: 120, isCountable: true, vitc: 6.7, vitd: 1.5, b12: 0, iron: 0.8, calcium: 15.6, potassium: 271.8, sodium: 191.3, magnesium: 26.6, zinc: 0.5 },
  'plain dosa': { cal: 380.9, pro: 10.3, carb: 64.1, fat: 8.4, fib: 5.2, defaultGrams: 80, isCountable: true, vitc: 0, vitd: 1.8, b12: 0, iron: 1.5, calcium: 19.4, potassium: 344.4, sodium: 143, magnesium: 55.4, zinc: 1.4 },
  uttapam: { cal: 255.9, pro: 6.2, carb: 36.3, fat: 9, fib: 4.4, defaultGrams: 100, isCountable: true, vitc: 9, vitd: 5.7, b12: 0, iron: 1.2, calcium: 40.9, potassium: 286.2, sodium: 228.7, magnesium: 41.7, zinc: 0.9 },
  poha: { cal: 294.5, pro: 6.1, carb: 35, fat: 14.1, fib: 3.7, defaultGrams: 150, vitc: 12.1, vitd: 3.7, b12: 0, iron: 3, calcium: 37.7, potassium: 334, sodium: 377.1, magnesium: 66.9, zinc: 1.1 },
  upma: { cal: 147.9, pro: 3.3, carb: 16.3, fat: 7.5, fib: 3.2, defaultGrams: 150, vitc: 4.4, vitd: 3.4, b12: 0, iron: 1.1, calcium: 21.6, potassium: 158.4, sodium: 101.6, magnesium: 21.3, zinc: 0.6 },
  'medu vada': { cal: 745.5, pro: 4.4, carb: 9.7, fat: 76.3, fib: 2.3, defaultGrams: 40, isCountable: true, vitc: 0, vitd: 1.6, b12: 0, iron: 1, calcium: 10.6, potassium: 220.2, sodium: 65.9, magnesium: 33, zinc: 0.6 },
  pesarattu: { cal: 286, pro: 12.3, carb: 31.9, fat: 11.7, fib: 6, defaultGrams: 90, isCountable: true, vitc: 5.6, vitd: 1.4, b12: 0, iron: 3.4, calcium: 36.4, potassium: 704.2, sodium: 61.4, magnesium: 86.9, zinc: 1.5 },

  // Rice dishes
  'plain pulao': { cal: 140.2, pro: 2.3, carb: 21.8, fat: 4.6, fib: 1.7, defaultGrams: 200, vitc: 1.1, vitd: 0.3, b12: 0, iron: 0.4, calcium: 12.8, potassium: 74.7, sodium: 193.8, magnesium: 12.3, zinc: 0.4 },
  'vegetable pulao': { cal: 113, pro: 2.7, carb: 17.5, fat: 3.3, fib: 2.7, defaultGrams: 200, vitc: 6, vitd: 2, b12: 0, iron: 0.6, calcium: 19.6, potassium: 133.8, sodium: 187.9, magnesium: 17.6, zinc: 0.4 },
  'chicken pulao': { cal: 108.2, pro: 6.1, carb: 11.2, fat: 8.5, fib: 1.6, defaultGrams: 250, vitc: 0.7, vitd: 0.4, b12: 0, iron: 1, calcium: 32.2, potassium: 170.8, sodium: 200, magnesium: 24.8, zinc: 0.5 },
  'mutton pulao': { cal: 130.8, pro: 6.5, carb: 11.3, fat: 10.8, fib: 1.7, defaultGrams: 250, vitc: 0.7, vitd: 0.4, b12: 0, iron: 1.2, calcium: 49.9, potassium: 177.7, sodium: 200, magnesium: 22.9, zinc: 0.4 },
  'mutton biryani': { cal: 190.8, pro: 7.4, carb: 22.5, fat: 7.7, fib: 2.4, defaultGrams: 300, vitc: 4.9, vitd: 2, b12: 0, iron: 1.3, calcium: 68.6, potassium: 212.1, sodium: 262.6, magnesium: 19.1, zinc: 0.5 },
  'vegetable biryani': { cal: 174.6, pro: 3.2, carb: 18.6, fat: 9.5, fib: 3.3, defaultGrams: 300, vitc: 13, vitd: 2.8, b12: 0, iron: 0.9, calcium: 33.5, potassium: 242.5, sodium: 183.8, magnesium: 24.4, zinc: 0.5 },
  'curd rice': { cal: 195.7, pro: 5.8, carb: 32.9, fat: 4.3, fib: 2.1, defaultGrams: 200, vitc: 2.4, vitd: 1.6, b12: 0, iron: 0.6, calcium: 101.5, potassium: 211.8, sodium: 213.3, magnesium: 24.3, zinc: 0.7 },
  'jeera pulao': { cal: 135.2, pro: 2.5, carb: 23.6, fat: 3.2, fib: 1.4, defaultGrams: 200, vitc: 0.5, vitd: 0.1, b12: 0, iron: 0.3, calcium: 7.3, potassium: 62.1, sodium: 219.7, magnesium: 11.3, zinc: 0.4 },
  khichdi: { cal: 143.2, pro: 5.6, carb: 19.6, fat: 4.5, fib: 2.5, defaultGrams: 200, vitc: 7.1, vitd: 0.5, b12: 0, iron: 1.1, calcium: 100.5, potassium: 384.9, sodium: 193.6, magnesium: 41.9, zinc: 0.7 },

  // Breads
  chapati: { cal: 202.3, pro: 5.9, carb: 35.6, fat: 3.6, fib: 6.3, defaultGrams: 40, isCountable: true, vitc: 0, vitd: 7.5, b12: 0, iron: 2.3, calcium: 17.2, potassium: 172.8, sodium: 1.2, magnesium: 69.4, zinc: 1.6 },
  'plain paratha': { cal: 298.3, pro: 5.1, carb: 30.7, fat: 16.9, fib: 5.4, defaultGrams: 60, isCountable: true, vitc: 0, vitd: 6.4, b12: 0, iron: 2, calcium: 14.8, potassium: 148.9, sodium: 62.1, magnesium: 59.9, zinc: 1.4 },
  'aloo paratha': { cal: 205, pro: 3.7, carb: 23.9, fat: 10.2, fib: 4.2, defaultGrams: 90, isCountable: true, vitc: 8.5, vitd: 4, b12: 0, iron: 1.5, calcium: 17.4, potassium: 272.9, sodium: 127.2, magnesium: 46.1, zinc: 0.9 },
  naan: { cal: 286.4, pro: 8.1, carb: 51.8, fat: 5, fib: 1.9, defaultGrams: 90, isCountable: true, vitc: 0.4, vitd: 4.4, b12: 0, iron: 1.3, calcium: 88, potassium: 166.2, sodium: 326.1, magnesium: 27.5, zinc: 0.8 },
  poori: { cal: 737.6, pro: 1.4, carb: 8.2, fat: 77.6, fib: 1.5, defaultGrams: 25, isCountable: true, vitc: 0, vitd: 1.7, b12: 0, iron: 0.6, calcium: 4, potassium: 39.9, sodium: 31.7, magnesium: 16.1, zinc: 0.4 },
  bhatura: { cal: 793.2, pro: 1.6, carb: 10.7, fat: 82.6, fib: 0.4, defaultGrams: 80, isCountable: true, vitc: 0, vitd: 0.9, b12: 0, iron: 0.3, calcium: 12.1, potassium: 30.1, sodium: 28.3, magnesium: 4.9, zinc: 0.2 },
  'makki ki roti': { cal: 264, pro: 3.5, carb: 24.2, fat: 16.8, fib: 5.2, defaultGrams: 50, isCountable: true, vitc: 2.3, vitd: 11.9, b12: 0, iron: 1.1, calcium: 14.8, potassium: 152.8, sodium: 236.2, magnesium: 53.5, zinc: 0.8 },

  // Dals and curries
  sambar: { cal: 96.9, pro: 3.4, carb: 10.6, fat: 4.4, fib: 3.5, defaultGrams: 150, vitc: 7.9, vitd: 3.3, b12: 0, iron: 1.2, calcium: 30.2, potassium: 298.3, sodium: 159.5, magnesium: 32.2, zinc: 0.5 },
  rajma: { cal: 143.7, pro: 6, carb: 16.4, fat: 5.8, fib: 5.8, defaultGrams: 200, vitc: 13.6, vitd: 12, b12: 0, iron: 2.3, calcium: 47.9, potassium: 485.9, sodium: 354.6, magnesium: 58.6, zinc: 0.9 },
  'dal makhani': { cal: 74, pro: 3.3, carb: 8, fat: 3.1, fib: 2.3, defaultGrams: 200, vitc: 2.6, vitd: 2.7, b12: 0, iron: 1.2, calcium: 20.6, potassium: 199.4, sodium: 41.8, magnesium: 27.4, zinc: 0.5 },
  'chana dal': { cal: 99.7, pro: 4.2, carb: 10, fat: 4.6, fib: 3.7, defaultGrams: 200, vitc: 4.6, vitd: 2.2, b12: 0, iron: 1.9, calcium: 22, potassium: 232.7, sodium: 46.4, magnesium: 29.5, zinc: 0.8 },
  chole: { cal: 163.4, pro: 6.1, carb: 20, fat: 6.8, fib: 4.7, defaultGrams: 200, vitc: 13.6, vitd: 5.4, b12: 0, iron: 1.8, calcium: 30.6, potassium: 334.3, sodium: 358, magnesium: 35.1, zinc: 0.9 },
  'palak paneer': { cal: 77.7, pro: 4, carb: 4.4, fat: 4.8, fib: 1.9, defaultGrams: 200, vitc: 20.4, vitd: 2.3, b12: 0, iron: 1.9, calcium: 113.2, potassium: 386.6, sodium: 166.9, magnesium: 54.1, zinc: 0.7 },
  'matar paneer': { cal: 134.8, pro: 6.6, carb: 9.3, fat: 7.8, fib: 3.3, defaultGrams: 200, vitc: 21.1, vitd: 7.1, b12: 0, iron: 1.1, calcium: 105.2, potassium: 188.2, sodium: 157.3, magnesium: 28, zinc: 1 },
  'paneer curry': { cal: 176.5, pro: 7.8, carb: 8.4, fat: 12.4, fib: 1.4, defaultGrams: 200, vitc: 9.9, vitd: 3.4, b12: 0, iron: 0.8, calcium: 189.1, potassium: 142.7, sodium: 216.1, magnesium: 21.8, zinc: 1.2 },
  'chicken curry': { cal: 129.2, pro: 11.8, carb: 3.4, fat: 7.6, fib: 1.4, defaultGrams: 200, vitc: 6.8, vitd: 3.6, b12: 0.2, iron: 0.9, calcium: 27.3, potassium: 253.5, sodium: 108, magnesium: 21.9, zinc: 0.6 },
  'chicken korma': { cal: 148, pro: 9.8, carb: 5.4, fat: 9.7, fib: 1.8, defaultGrams: 200, vitc: 2.9, vitd: 1.4, b12: 0.2, iron: 1.1, calcium: 68.7, potassium: 277.5, sodium: 119.2, magnesium: 29.6, zinc: 0.7 },
  'mutton korma': { cal: 115.6, pro: 7.1, carb: 2.5, fat: 8.5, fib: 0.8, defaultGrams: 200, vitc: 1.5, vitd: 0.2, b12: 1, iron: 1.1, calcium: 79.1, potassium: 165.9, sodium: 56.9, magnesium: 8.6, zinc: 0.2 },
  'fish curry': { cal: 111.1, pro: 8.8, carb: 3.8, fat: 6.7, fib: 1.9, defaultGrams: 200, vitc: 8.9, vitd: 3.3, b12: 1.2, iron: 1.1, calcium: 52.1, potassium: 242, sodium: 184.7, magnesium: 24.1, zinc: 0.5 },
  'egg curry': { cal: 117.5, pro: 5.4, carb: 4, fat: 8.8, fib: 2.1, defaultGrams: 200, vitc: 12.6, vitd: 4.6, b12: 0.5, iron: 1.5, calcium: 41.6, potassium: 198.5, sodium: 142.1, magnesium: 21.7, zinc: 0.6 },
  'aloo curry': { cal: 89.6, pro: 1.5, carb: 10.4, fat: 4.5, fib: 2.4, defaultGrams: 200, vitc: 20.9, vitd: 3.4, b12: 0, iron: 1, calcium: 23.7, potassium: 383.4, sodium: 78.4, magnesium: 25.3, zinc: 0.3 },
  rasam: { cal: 26.7, pro: 1.1, carb: 3.4, fat: 0.9, fib: 1.6, defaultGrams: 150, vitc: 4.4, vitd: 3, b12: 0, iron: 0.6, calcium: 16.6, potassium: 130.7, sodium: 104.1, magnesium: 14.7, zinc: 0.2 },
  'aloo matar': { cal: 100.9, pro: 3.5, carb: 9.7, fat: 5.1, fib: 3.6, defaultGrams: 200, vitc: 25.2, vitd: 7.1, b12: 0, iron: 1, calcium: 21.1, potassium: 274.3, sodium: 154.8, magnesium: 27.5, zinc: 0.6 },

  // Snacks
  'vegetable samosa': { cal: 443.1, pro: 2.2, carb: 13.2, fat: 42.2, fib: 1.5, defaultGrams: 50, isCountable: true, vitc: 10, vitd: 1.9, b12: 0, iron: 0.6, calcium: 10.4, potassium: 189.1, sodium: 107.7, magnesium: 14.8, zinc: 0.3 },
  'aloo samosa': { cal: 577.4, pro: 1.7, carb: 9.2, fat: 59.2, fib: 1.2, defaultGrams: 50, isCountable: true, vitc: 8, vitd: 1.7, b12: 0, iron: 0.5, calcium: 7.6, potassium: 137.5, sodium: 77.1, magnesium: 11.4, zinc: 0.2 },
  'onion pakora': { cal: 674.6, pro: 1.9, carb: 5.4, fat: 71.8, fib: 1.1, defaultGrams: 80, vitc: 0.8, vitd: 0.1, b12: 0, iron: 0.4, calcium: 8, potassium: 46.1, sodium: 63.5, magnesium: 7.1, zinc: 0.2 },
  'vegetable cutlet': { cal: 665.5, pro: 1.2, carb: 4.7, fat: 71.3, fib: 0.9, defaultGrams: 60, isCountable: true, vitc: 5, vitd: 0.7, b12: 0, iron: 0.4, calcium: 13.5, potassium: 103.1, sodium: 85.4, magnesium: 8, zinc: 0.2 },
  kachori: { cal: 712.7, pro: 2.5, carb: 12.8, fat: 72.3, fib: 1, defaultGrams: 45, isCountable: true, vitc: 0.9, vitd: 1.3, b12: 0, iron: 0.6, calcium: 7.8, potassium: 78.1, sodium: 90.6, magnesium: 12.9, zinc: 0.3 },

  // Sweets
  'gulab jamun': { cal: 471.2, pro: 0.9, carb: 28.2, fat: 40.2, fib: 0, defaultGrams: 40, isCountable: true, vitc: 0.1, vitd: 0.1, b12: 0, iron: 0.1, calcium: 26.1, potassium: 33.7, sodium: 67.3, magnesium: 3.2, zinc: 0.1 },
  'besan ladoo': { cal: 476.9, pro: 8.9, carb: 62.6, fat: 22.8, fib: 4.4, defaultGrams: 25, isCountable: true, vitc: 0, vitd: 0.8, b12: 0, iron: 1.5, calcium: 25.3, potassium: 142.3, sodium: 5.5, magnesium: 26.8, zinc: 0.7 },
  'rice kheer': { cal: 75, pro: 2.3, carb: 10, fat: 3, fib: 0.2, defaultGrams: 150, vitc: 1.3, vitd: 0.1, b12: 0, iron: 0.2, calcium: 75.6, potassium: 83.1, sodium: 16.2, magnesium: 7.3, zinc: 0.3 },
  'suji halwa': { cal: 225.6, pro: 2.2, carb: 24.7, fat: 13.4, fib: 1.9, defaultGrams: 100, vitc: 0, vitd: 1.5, b12: 0, iron: 0.7, calcium: 11.8, potassium: 70.5, sodium: 1.3, magnesium: 13.1, zinc: 0.4 },
  'gajar halwa': { cal: 172.6, pro: 3.1, carb: 18.5, fat: 9.7, fib: 2.7, defaultGrams: 100, vitc: 3.9, vitd: 0.9, b12: 0, iron: 0.8, calcium: 106.9, potassium: 249.9, sodium: 40, magnesium: 23, zinc: 0.5 },
  'moong dal halwa': { cal: 349.8, pro: 8.4, carb: 40.2, fat: 17.7, fib: 2.6, defaultGrams: 100, vitc: 0, vitd: 1, b12: 0, iron: 1.5, calcium: 110.4, potassium: 386.9, sodium: 11.2, magnesium: 46.8, zinc: 1.1 },
};
