export function formatQuantity(value: number, unit: string): string {
  const rounded = Math.round(value);
  const label = rounded === 1 || unit.endsWith("s") ? unit : `${unit}s`;
  return `${rounded.toLocaleString()} ${label}`;
}
