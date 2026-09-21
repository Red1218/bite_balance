import * as XLSX from 'xlsx';
import type { ChatMealItem, MealTime } from '@/components/MealReviewList';

export interface ParsedImport {
  loggedDate: string;
  items: ChatMealItem[];
}

const MEAL_TIME_KEYWORDS: { mealTime: MealTime; keyword: string }[] = [
  { mealTime: 'breakfast', keyword: 'breakfast' },
  { mealTime: 'lunch', keyword: 'lunch' },
  { mealTime: 'dinner', keyword: 'dinner' },
  { mealTime: 'snack', keyword: 'snack' },
];

// "Meal 1 - Lunch" -> 'lunch'; no keyword match -> 'snack' (same fallback chat-meal uses).
export const parseMealTime = (mealCell: unknown): MealTime => {
  const text = String(mealCell ?? '').toLowerCase();
  const match = MEAL_TIME_KEYWORDS.find((m) => text.includes(m.keyword));
  return match ? match.mealTime : 'snack';
};

// "100 g" -> 100. Anything else ("3", "1 spray", a fraction-of-batch note) -> null: not a weight.
export const parseGrams = (quantity: unknown): number | null => {
  const text = String(quantity ?? '').trim();
  const match = text.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  return match ? parseFloat(match[1]) : null;
};

const ZERO_MICROS = {
  vitaminC: 0, vitaminD: 0, vitaminB12: 0, iron: 0, calcium: 0,
  potassium: 0, sodium: 0, magnesium: 0, zinc: 0,
};

interface MealRow {
  Meal?: unknown;
  Food?: unknown;
  Quantity?: unknown;
  'Calories (kcal)'?: unknown;
  'Protein (g)'?: unknown;
  'Carbs (g)'?: unknown;
  'Fat (g)'?: unknown;
  'Fiber (g)'?: unknown;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Reads the "Date" key/value row from Daily Summary regardless of whether that
// sheet has its own header row first -- the two real sample files disagree on
// that, so this searches for the row by its first cell instead of a fixed index.
const findDailySummaryDate = (workbook: XLSX.WorkBook): string => {
  const sheet = workbook.Sheets['Daily Summary'];
  if (!sheet) throw new Error('This file has no "Daily Summary" sheet.');
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const dateRow = rows.find((row) => String(row[0] ?? '').trim().toLowerCase() === 'date');
  if (!dateRow || dateRow[1] == null) {
    throw new Error('No "Date" row found in the "Daily Summary" sheet.');
  }
  const value = dateRow[1];
  if (value instanceof Date) return value.toISOString().split('T')[0];
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not read the date "${text}" from the "Daily Summary" sheet.`);
  }
  return parsed.toISOString().split('T')[0];
};

export const parseMealLogFile = (buffer: ArrayBuffer): ParsedImport => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const mealsSheet = workbook.Sheets["Today's Meals"];
  if (!mealsSheet) throw new Error('This file has no "Today\'s Meals" sheet.');
  const rows = XLSX.utils.sheet_to_json<MealRow>(mealsSheet);

  const items: ChatMealItem[] = rows
    .filter((row) => {
      const food = String(row.Food ?? '').trim();
      const hasQuantity = row.Quantity != null && String(row.Quantity).trim().length > 0;
      return food.length > 0 && food.toUpperCase() !== 'TOTAL' && hasQuantity;
    })
    .map((row) => {
      const food = String(row.Food ?? '').trim();
      const quantityText = String(row.Quantity ?? '').trim();
      const grams = parseGrams(quantityText);
      return {
        name: grams === null ? `${food} (${quantityText})` : food,
        mealTime: parseMealTime(row.Meal),
        grams: grams ?? 0,
        calories: num(row['Calories (kcal)']),
        protein: num(row['Protein (g)']),
        carbs: num(row['Carbs (g)']),
        fat: num(row['Fat (g)']),
        fiber: num(row['Fiber (g)']),
        ...ZERO_MICROS,
      };
    });

  if (items.length === 0) throw new Error('No food rows found in "Today\'s Meals".');

  return { loggedDate: findDailySummaryDate(workbook), items };
};
