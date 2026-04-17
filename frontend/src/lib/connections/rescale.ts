export function parseRescaleString(
  rescale: string | null
): { min: number; max: number } | null {
  if (!rescale) return null;
  const parts = rescale.split(",");
  if (parts.length !== 2) return null;
  const min = Number(parts[0].trim());
  const max = Number(parts[1].trim());
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (min >= max) return null;
  return { min, max };
}
