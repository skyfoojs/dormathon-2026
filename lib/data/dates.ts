import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { TODAY_ISO } from "@/lib/db/seed";

export function daysFromToday(isoDate: string): number {
  return differenceInCalendarDays(parseISO(isoDate), parseISO(TODAY_ISO));
}

export function formatShortDate(isoDate: string): string {
  return format(parseISO(isoDate), "d MMM");
}

export function formatDueLabel(isoDate: string): string {
  const days = daysFromToday(isoDate);
  if (days === 0) return "Due today";
  if (days > 0) return `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late`;
}
