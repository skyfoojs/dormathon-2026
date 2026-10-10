import { cn } from "@/lib/cn";

export function CountBadge({
  count,
  className,
  label,
}: {
  count: number;
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-red px-1.5 text-xs font-bold text-white",
        className,
      )}
      aria-label={label}
    >
      {count}
    </span>
  );
}
