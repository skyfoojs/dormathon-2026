import { Label, Select } from "@/components/ui/Input";

export function ItemSelect({
  id,
  items,
  value,
  onChange,
}: {
  id: string;
  items: { id: number; name: string }[];
  value: number | null;
  onChange: (itemId: number) => void;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <Label htmlFor={id}>Item</Label>
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
