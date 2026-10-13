// Self-check for promptEcho.ts. Run: node supabase/functions/transcribe/promptEcho.check.ts
import { isPromptEcho } from './promptEcho.ts';

// Keep identical to PROMPT in index.ts (index.ts calls serve(), so it can't be imported).
const PROMPT =
  'Meal description. Indian foods like idli, dosa, paneer, roti, chapati, dal, sambar, biryani, katori; quantities in grams.';

let failures = 0;
const eq = (actual: boolean, expected: boolean, label: string) => {
  if (actual !== expected) {
    failures++;
    console.error(`FAIL ${label}: expected ${expected}, got ${actual}`);
  }
};

eq(isPromptEcho(PROMPT, PROMPT), true, 'full prompt');
eq(
  isPromptEcho('Indian foods like idli, dosa, paneer, roti, chapati, dal, sambar, biryani, katori; quantities in grams.', PROMPT),
  true,
  'observed device echo'
);
eq(isPromptEcho('Dal.', PROMPT), false, 'short real answer');
eq(isPromptEcho('Two idli and sambar', PROMPT), false, 'real meal');
eq(isPromptEcho('Two eggs and toast with butter and banana.', PROMPT), false, 'real long meal');
eq(isPromptEcho('', PROMPT), false, 'empty');

if (failures) process.exitCode = 1;
else console.log('promptEcho: all checks passed');
