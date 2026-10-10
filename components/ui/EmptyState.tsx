import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong bg-card p-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-tint text-navy">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-strong-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
