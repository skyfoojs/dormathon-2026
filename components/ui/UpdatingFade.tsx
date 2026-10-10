import { cn } from "@/lib/cn";

export function UpdatingFade({
  updating,
  className,
  children,
}: {
  updating: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy={updating} className={cn("transition-opacity duration-200", updating && "opacity-60", className)}>
      {children}
    </div>
  );
}
