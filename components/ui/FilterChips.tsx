import { cn } from "@/lib/cn";

export type FilterChip<T extends string> = { id: T; label: string; count: number };

export function FilterChips<T extends string>({
  chips,
  value,
  onChange,
  label,
}: {
  chips: FilterChip<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {chips.map((chip) => {
        const pressed = value === chip.id;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(chip.id)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md border-2 px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
              pressed ? "border-navy bg-navy text-white" : "border-line bg-card text-ink hover:bg-blue-tint",
            )}
          >
            {chip.label}
            <span className={cn("rounded-full px-1.5 font-mono text-xs", pressed ? "bg-white/20" : "bg-page")}>
              {chip.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
