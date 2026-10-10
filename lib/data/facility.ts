import type { Facility } from "@/lib/db/types";

// Matches the reference design's format exactly: "Public · Large · Kuala
// Lumpur, W.P. Kuala Lumpur" (sector · size tier · district, state).
export function formatFacilitySubtitle(facility: Facility): string {
  return `${facility.sector} · ${facility.size_tier} · ${facility.district}, ${facility.state}`;
}
