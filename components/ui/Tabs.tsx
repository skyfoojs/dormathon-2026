"use client";

import * as RadixTabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = RadixTabs.Root;
export const TabsContent = RadixTabs.Content;

export function TabsList({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<typeof RadixTabs.List>) {
  return (
    <RadixTabs.List
      className={cn("flex gap-2 border-b border-line", className)}
      {...rest}
    />
  );
}

export function TabsTrigger({
  className,
  ...rest
}: React.ComponentPropsWithoutRef<typeof RadixTabs.Trigger>) {
  return (
    <RadixTabs.Trigger
      className={cn(
        "min-h-11 -mb-px border-b-2 border-transparent px-1 text-sm font-semibold text-muted transition-colors duration-150",
        "data-[state=active]:border-navy data-[state=active]:text-navy",
        "hover:text-navy focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light",
        className,
      )}
      {...rest}
    />
  );
}
