import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";

export function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  // Leave out to hide the edit button, e.g. for a row that is locked.
  onEdit?: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {onEdit ? (
        <IconButton aria-label={`Edit ${label}`} title="Edit" onClick={onEdit}>
          <Pencil size={18} aria-hidden="true" />
        </IconButton>
      ) : null}
      <IconButton aria-label={`Delete ${label}`} onClick={onDelete}>
        <Trash2 size={18} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
