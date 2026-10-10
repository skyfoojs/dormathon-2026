"use client";

import * as RadixSwitch from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onCheckedChange,
  label,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <RadixSwitch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full border-[1.5px] transition-colors duration-150 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
          checked ? "border-navy bg-navy" : "border-line-strong bg-card",
        )}
      >
        <RadixSwitch.Thumb
          className={cn(
            "block h-5 w-5 translate-x-0.5 rounded-full bg-white transition-transform duration-150 will-change-transform",
            checked && "translate-x-6",
          )}
        />
      </RadixSwitch.Root>
    </div>
  );
}
