import { cn } from '@/lib/utils';

const DIGITS = '0123456789'.split('');

/**
 * A number whose digits roll like a meter: each digit is a 0-9 strip that slides to its value,
 * the rightmost first. Keys count from the right, so 1,936 -> 936 drops the left digit cleanly.
 */
const Odometer = ({ value, className }: { value: number; className?: string }) => {
  const text = Math.abs(value).toLocaleString('en-US');
  const chars = text.split('');
  return (
    <span className={cn('inline-flex leading-none', className)}>
      <span className="sr-only">{text}</span>
      {chars.map((ch, i) => {
        const fromRight = chars.length - 1 - i;
        if (!/\d/.test(ch)) {
          return (
            <span key={`s${fromRight}`} aria-hidden className="inline-block h-[1.1em] leading-[1.1em]">
              {ch}
            </span>
          );
        }
        return (
          <span key={`d${fromRight}`} aria-hidden className="relative inline-block h-[1.1em] overflow-hidden">
            <span className="invisible">0</span>
            <span
              className="absolute left-0 top-0 flex flex-col"
              style={{
                transform: `translateY(-${Number(ch) * 10}%)`,
                transition: `transform 900ms cubic-bezier(.34,1.25,.64,1) ${fromRight * 70}ms`,
              }}
            >
              {DIGITS.map((d) => (
                <span key={d} className="h-[1.1em] leading-[1.1em]">
                  {d}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
};

export default Odometer;
