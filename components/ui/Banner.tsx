import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function SavedBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-green-border bg-green-tint px-4 py-3 text-sm text-green-text">
      <span>
        Saved. New input triggers a sync, so external sources and predictions
        refresh now.
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-green-text transition-colors duration-150 hover:bg-green-border/40 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-blue-light"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function ConfirmDeleteBanner({
  label,
  onCancel,
  onConfirm,
}: {
  label: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-md border border-amber-border bg-amber-bg px-4 py-3 text-sm text-amber-text">
      <span>Delete {label}? This removes the row from the database.</span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} className="border-red bg-red hover:bg-red-dark">
          Delete
        </Button>
      </div>
    </div>
  );
}

export function UnusualInputNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-md border border-amber-border bg-amber-bg px-3 py-2 text-sm text-amber-text"
    >
      <span className="font-semibold">Check this. </span>
      {message}
    </div>
  );
}

export function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-red bg-red/5 p-4 text-sm text-red-dark">
      {children}
    </div>
  );
}
