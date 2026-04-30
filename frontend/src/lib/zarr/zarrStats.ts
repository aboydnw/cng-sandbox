/**
 * Reads the standard min/max convention attrs from a zarr variable's attrs
 * map and returns a `{ min, max }` rescale range, or `null` if no recognized
 * attrs are present.
 *
 * Recognized in priority order:
 *   1. `valid_min` + `valid_max` (CF convention)
 *   2. `actual_range` as a 2-tuple [min, max]
 *
 * `scale_factor` and `add_offset` are intentionally NOT applied — they describe
 * how to convert stored values to physical values, but the rescale range we
 * want is in the *physical* domain that the user enters as min/max in the UI.
 * The renderer's pipeline applies scale_factor/add_offset itself.
 */
export interface VariableStats {
  min: number;
  max: number;
}

export function extractStats(
  attrs: Record<string, unknown>
): VariableStats | null {
  const validMin = attrs.valid_min;
  const validMax = attrs.valid_max;
  if (typeof validMin === "number" && typeof validMax === "number") {
    if (validMin <= validMax) return { min: validMin, max: validMax };
    return null;
  }

  const range = attrs.actual_range;
  if (
    Array.isArray(range) &&
    range.length === 2 &&
    typeof range[0] === "number" &&
    typeof range[1] === "number" &&
    range[0] <= range[1]
  ) {
    return { min: range[0], max: range[1] };
  }

  return null;
}
