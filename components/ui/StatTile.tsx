import { Eyebrow } from "@/components/ui/Eyebrow";
import { cn } from "@/lib/cn";

export function StatTile({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-md border border-line bg-page px-3.5 py-3">
      <Eyebrow>{label}</Eyebrow>
      <span className={cn("text-xl", mono ? "font-mono font-medium" : "font-semibold")}>{value}</span>
    </div>
  );
}
