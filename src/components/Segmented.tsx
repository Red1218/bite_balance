import { cn } from '@/lib/utils';

interface SegmentedProps<T extends string> {
  options: readonly (readonly [T, string])[];
  value: T;
  onChange: (value: T) => void;
  /** Read out by screen readers for the whole group. */
  label: string;
  className?: string;
}

/** A row of mutually exclusive choices; the chosen one is raised. */
const Segmented = <T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) => (
  <div role="radiogroup" aria-label={label} className={cn('flex h-11 gap-[2px] rounded-full bg-muted p-[3px]', className)}>
    {options.map(([v, text]) => (
      <button
        key={v}
        type="button"
        role="radio"
        aria-checked={value === v}
        onClick={() => onChange(v)}
        className={cn(
          'flex-1 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors',
          value === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
        )}
      >
        {text}
      </button>
    ))}
  </div>
);

export default Segmented;
