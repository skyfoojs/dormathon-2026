import { cn } from "@/lib/cn";

// Panel order: demand, external signal, supply.
export const MODEL_COLOR = ["bg-navy text-white", "bg-blue-light text-ink", "bg-amber-border text-ink"];

const SIZE_CLASSES = {
  sm: "h-6 w-6 rounded text-xs",
  md: "h-8 w-8 rounded-md text-sm",
  lg: "h-12 w-12 rounded-lg text-xl",
};

export function ModelBadge({
  name,
  modelIndex,
  size = "md",
}: {
  name: string;
  modelIndex: number;
  size?: keyof typeof SIZE_CLASSES;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("flex shrink-0 items-center justify-center font-bold", SIZE_CLASSES[size], MODEL_COLOR[modelIndex])}
    >
      {name[0]}
    </span>
  );
}
