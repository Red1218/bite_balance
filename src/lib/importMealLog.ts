import * as XLSX from 'xlsx';
import type { ChatMealItem, MealTime } from '@/components/MealReviewList';
import { fmtLocalDate } from '@/lib/utils';

export { fmtLocalDate };

export interface ParsedImport {
  /** The date the file itself states, if any -- a starting point for the date
   * picker on the Import screen, never the final answer: the user can log any
   * file to any date, and plenty of real exports don't state one at all. */
  loggedDate: string | null;
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
  Amount?: unknown;
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

// SheetJS lands Date-typed cells 1ms under local midnight -- nudge forward a
// second before formatting so that quirk never rounds a cell to the day before.
const fmtCellDate = (d: Date): string => fmtLocalDate(new Date(d.getTime() + 1000));

// The meal-time sheet's name and its quantity column have both drifted across
// real ChatGPT exports ("Today's Meals" / "Quantity" one day, "Meal Log" /
// "Amount" the next) -- accept either rather than failing on a cosmetic rename.
const MEAL_SHEET_NAMES = ["Today's Meals", 'Meal Log'];

// Best-effort only: reads the "Date" key/value row from Daily Summary when
// present, regardless of whether that sheet has its own header row first.
// Never throws -- plenty of real exports have no Daily Summary sheet, or one
// with no Date row, and the date is just a starting point the user can change.
const findDailySummaryDate = (workbook: XLSX.WorkBook): string | null => {
  const sheet = workbook.Sheets['Daily Summary'];
  if (!sheet) return null;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  const dateRow = rows.find((row) => String(row[0] ?? '').trim().toLowerCase() === 'date');
  const value = dateRow?.[1];
  if (value == null) return null;
  if (value instanceof Date) return fmtCellDate(value);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : fmtCellDate(parsed);
};

export const parseMealLogFile = (buffer: ArrayBuffer): ParsedImport => {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

  const mealsSheetName = MEAL_SHEET_NAMES.find((name) => workbook.Sheets[name]);
  if (!mealsSheetName) {
    throw new Error('This file has no "Today\'s Meals" (or "Meal Log") sheet.');
  }
  const rows = XLSX.utils.sheet_to_json<MealRow>(workbook.Sheets[mealsSheetName]);

  const items: ChatMealItem[] = rows
    .filter((row) => {
      const food = String(row.Food ?? '').trim();
      const quantity = row.Quantity ?? row.Amount;
      const hasQuantity = quantity != null && String(quantity).trim().length > 0;
      return food.length > 0 && food.toUpperCase() !== 'TOTAL' && hasQuantity;
    })
    .map((row) => {
      const food = String(row.Food ?? '').trim();
      const quantityText = String(row.Quantity ?? row.Amount ?? '').trim();
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

  if (items.length === 0) {
    throw new Error(`No food rows found in "${mealsSheetName}".`);
  }

  return { loggedDate: findDailySummaryDate(workbook), items };
};
