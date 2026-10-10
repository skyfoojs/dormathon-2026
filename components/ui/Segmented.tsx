import { cn, focusRingClasses } from "@/lib/cn";

export function Segmented<T extends string | number>({
  label,
  labelledBy,
  options,
  value,
  onChange,
  className,
}: {
  label?: string;
  labelledBy?: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} aria-labelledby={labelledBy} className={cn("flex", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 border-2 px-4 font-mono text-xs font-medium tracking-wide uppercase transition-colors duration-150 first:rounded-l-md last:rounded-r-md not-first:border-l-0",
            focusRingClasses,
            value === option.value
              ? "border-navy bg-navy text-white"
              : "border-line-strong bg-card text-ink hover:bg-blue-tint",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
