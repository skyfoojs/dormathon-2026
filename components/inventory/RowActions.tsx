import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/Button";

export function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <IconButton aria-label={`Edit ${label}`} onClick={onEdit}>
        <Pencil size={16} aria-hidden="true" />
      </IconButton>
      <IconButton aria-label={`Delete ${label}`} onClick={onDelete}>
        <Trash2 size={16} aria-hidden="true" />
      </IconButton>
    </div>
  );
}
