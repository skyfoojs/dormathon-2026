import { cn } from "@/lib/cn";

export function Eyebrow({
  className,
  children,
  as: Component = "span",
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  as?: React.ElementType;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Component
      className={cn("font-mono text-xs font-medium tracking-wide text-muted uppercase", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
