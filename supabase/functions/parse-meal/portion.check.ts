// Self-check for portion.ts. Run: node supabase/functions/parse-meal/portion.check.ts
import { portionFactor, type FoodPortion } from './portion.ts';

let failures = 0;
const eq = (actual: number, expected: number, label: string) => {
  if (Math.abs(actual - expected) > 1e-9) {
    failures++;
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
  }
};

const idli: FoodPortion = { serving_size: 50, serving_unit: 'piece', user_id: null }; // per 100 g
const eggs: FoodPortion = { serving_size: 3, serving_unit: 'eggs', user_id: 'u' }; // per 3 eggs
const bread: FoodPortion = { serving_size: 60, serving_unit: 'g', user_id: 'u' }; // per 60 g
const oil: FoodPortion = { serving_size: 1, serving_unit: 'spray', user_id: 'u' }; // per spray

// Built-in foods: unchanged per-100 g maths
eq(portionFactor('2 idli', idli), 1, 'built-in: 2 pieces of 50 g = 100 g');
eq(portionFactor('idli', idli), 0.5, 'built-in: one piece');
eq(portionFactor('150g idli', idli), 1.5, 'built-in: grams win over pieces');

// Own foods, counted units: count against the serving's count
eq(portionFactor('3 eggs', eggs), 1, 'own: 3 eggs = one 3-egg serving');
eq(portionFactor('6 eggs', eggs), 2, 'own: 6 eggs = two servings');
eq(portionFactor('two eggs', eggs), 2 / 3, 'own: word count');
eq(portionFactor('eggs', eggs), 1, 'own: no count = one serving');
eq(portionFactor('100g eggs', eggs), 1, 'own: grams on a non-gram serving = one serving');
eq(portionFactor('2 spray oil', oil), 2, 'own: 2 sprays');

// Own foods, gram servings: grams against the serving's grams, bare count = servings
eq(portionFactor('120g sourdough', bread), 2, 'own: 120 g of a 60 g serving');
eq(portionFactor('2 sourdough', bread), 2, 'own: bare count = servings');
eq(portionFactor('sourdough', bread), 1, 'own: nothing = one serving');

if (failures) process.exitCode = 1;
else console.log('portion: all checks passed');
