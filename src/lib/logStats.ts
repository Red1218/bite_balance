// Pure logging stats for the You page -- no React, no Supabase. Dates are local YYYY-MM-DD days.

const dayNumber = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Longest run of consecutive days in `dates` (any order, duplicates allowed). */
export const bestStreak = (dates: string[]) => {
  const days = [...new Set(dates)].map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d - days[i - 1] === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
};

/** Monday-first: whether each day of the week containing `today` has an entry in `logged`. */
export const weekLogged = (logged: Set<string>, today: string) => {
  const t = dayNumber(today);
  const monday = t - ((new Date(t * 86_400_000).getUTCDay() + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => logged.has(new Date((monday + i) * 86_400_000).toISOString().slice(0, 10)));
};
