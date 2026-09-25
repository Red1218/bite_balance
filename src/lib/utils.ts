import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formats a Date as YYYY-MM-DD from its LOCAL calendar components -- never
// .toISOString(), which converts to UTC first and is off by a day for any
// local-midnight Date in a positive UTC offset timezone (e.g. IST).
export const fmtLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
