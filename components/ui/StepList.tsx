import { cn } from "@/lib/cn";

export type Step = {
  title: string;
  text: string;
};

export function StepList({
  steps,
  className,
}: {
  steps: Step[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col divide-y divide-line border-t border-line", className)}>
      {steps.map((step, i) => (
        <li key={step.title} className="flex items-start gap-3 py-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-border bg-blue-tint font-mono text-xs text-navy">
            {i + 1}
          </span>
          <div>
            <p className="text-sm font-semibold">{step.title}</p>
            <p className="text-sm text-strong-muted">{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
