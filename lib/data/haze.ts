import type { HazeApiCategory } from "@/lib/db/types";
import type { TagTone } from "@/components/ui/Tag";

const CATEGORY_TONE: Record<HazeApiCategory, TagTone> = {
  Good: "green",
  Moderate: "blue",
  Unhealthy: "amber",
  "Very unhealthy": "red",
  Hazardous: "violet",
};

const CATEGORY_BAR_CLASS: Record<HazeApiCategory, string> = {
  Good: "bg-green-border",
  Moderate: "bg-blue-light",
  Unhealthy: "bg-amber-border",
  "Very unhealthy": "bg-red",
  Hazardous: "bg-violet-text",
};

const CATEGORY_TEXT_CLASS: Record<HazeApiCategory, string> = {
  Good: "text-green-text",
  Moderate: "text-navy",
  Unhealthy: "text-amber-text",
  "Very unhealthy": "text-red-dark",
  Hazardous: "text-violet-text",
};

export function hazeCategoryTone(category: HazeApiCategory): TagTone {
  return CATEGORY_TONE[category];
}

export function hazeCategoryBarClass(category: HazeApiCategory): string {
  return CATEGORY_BAR_CLASS[category];
}

export function hazeCategoryTextClass(category: HazeApiCategory): string {
  return CATEGORY_TEXT_CLASS[category];
}
