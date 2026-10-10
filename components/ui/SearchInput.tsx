import { Search } from "lucide-react";
import { Input, Label } from "@/components/ui/Input";

export function SearchInput({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor={id} className="sr-only">
        {label}
      </Label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="search"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-64 pl-9"
        />
      </div>
    </div>
  );
}
