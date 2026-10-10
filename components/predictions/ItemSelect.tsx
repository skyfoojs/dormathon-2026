import { Label, Select } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

export function ItemSelect({
  id,
  items,
  value,
  onChange,
  updating = false,
}: {
  id: string;
  items: { id: number; name: string }[];
  value: number | null;
  onChange: (itemId: number) => void;
  updating?: boolean;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>Item</Label>
        <span role="status" className={cn("text-xs text-muted", !updating && "invisible")}>
          Updating{"…"}
        </span>
      </div>
      <Select
        id={id}
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={items.length === 0}
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
