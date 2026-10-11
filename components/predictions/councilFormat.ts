import type { TagTone } from "@/components/ui/Tag";
import { formatShortDate } from "@/lib/data/dates";
import { formatQuantity } from "@/lib/data/units";
import type { UsageOutlook } from "@/lib/forecast/outlook";

export const BIG_CHANGE = 0.3;

export function impactLabel(impact: string | null): string | null {
  if (impact === "both") return "Demand and supply";
  if (impact === "demand") return "Demand";
  if (impact === "supply") return "Supply";
  return null;
}

export function usageChange(multiplier: number): { text: string; short: string; tone: TagTone; pct: number } {
  const pct = Math.round((multiplier - 1) * 100);
  if (pct > 0) return { text: `▲ ${pct}% more than algorithmic`, short: `▲ ${pct}%`, tone: "amber", pct };
  if (pct < 0) return { text: `▼ ${-pct}% less than algorithmic`, short: `▼ ${-pct}%`, tone: "blue", pct };
  return { text: "Same as algorithmic", short: "Same", tone: "grey", pct };
}

export function isBigChange(multiplier: number | null): boolean {
  return multiplier !== null && Math.abs(multiplier - 1) >= BIG_CHANGE;
}

export function backToNormal(fadeDays: number | null): string {
  return fadeDays === null ? "Lasting change" : `Back to normal in ${fadeDays} days`;
}

export function outlookText(outlook: UsageOutlook | null, unit: string): string {
  if (!outlook) return "No forecast";
  const runsOut = outlook.threshold === 0;
  if (outlook.kind === "already") return runsOut ? "Already out of stock" : "Already at the restock level";
  if (outlook.kind === "beyond") return runsOut ? "Won't run out within 12 weeks" : "Stays above the restock level for 12+ weeks";
  const until = runsOut ? `runs out ${formatShortDate(outlook.date)}` : `until ${formatShortDate(outlook.date)}`;
  return `Forecasted usage: ${formatQuantity(outlook.usage, unit)} in ${outlook.days} days (${until})`;
}

export function outlookCells(outlook: UsageOutlook | null, unit: string): { usage: string; days: string } {
  if (!outlook) return { usage: "—", days: "—" };
  if (outlook.kind === "already") return { usage: "—", days: "Now" };
  if (outlook.kind === "beyond") return { usage: "—", days: "12+ weeks" };
  return { usage: formatQuantity(outlook.usage, unit), days: `${outlook.days} (${formatShortDate(outlook.date)})` };
}

export function personaInitials(persona: string): string {
  const words = persona.split(/[\s/&]+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
