"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ModalSize = "md" | "lg";

const SIZE_CLASSES: Record<ModalSize, string> = {
  md: "max-w-2xl",
  lg: "max-w-4xl",
};

export function Modal({
  open,
  onOpenChange,
  title,
  size = "md",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  size?: ModalSize;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-ink/30" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            "fixed inset-4 z-50 m-auto flex h-fit max-h-full w-auto flex-col gap-4 overflow-hidden rounded-card border border-line bg-card p-6 shadow-lg focus:outline-none sm:inset-8",
            SIZE_CLASSES[size],
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-navy transition-colors duration-150 hover:bg-blue-tint focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
