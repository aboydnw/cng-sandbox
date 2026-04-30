import { describe, it, expect } from "vitest";
import { extractStats } from "../zarrStats";

describe("extractStats", () => {
  it("uses valid_min and valid_max when both present", () => {
    expect(extractStats({ valid_min: 200, valid_max: 320 })).toEqual({
      min: 200,
      max: 320,
    });
  });

  it("uses actual_range tuple when present", () => {
    expect(extractStats({ actual_range: [-1.5, 1.5] })).toEqual({
      min: -1.5,
      max: 1.5,
    });
  });

  it("prefers valid_min/valid_max over actual_range", () => {
    expect(
      extractStats({
        valid_min: 0,
        valid_max: 1,
        actual_range: [-10, 10],
      })
    ).toEqual({ min: 0, max: 1 });
  });

  it("returns null when no recognized attrs present", () => {
    expect(
      extractStats({ units: "K", standard_name: "air_temperature" })
    ).toBeNull();
  });

  it("returns null when only one of valid_min/valid_max is present", () => {
    expect(extractStats({ valid_min: 200 })).toBeNull();
  });

  it("returns null for non-numeric values", () => {
    expect(extractStats({ valid_min: "low", valid_max: "high" })).toBeNull();
  });

  it("returns null for actual_range that is not a 2-tuple", () => {
    expect(extractStats({ actual_range: [1, 2, 3] })).toBeNull();
    expect(extractStats({ actual_range: [42] })).toBeNull();
  });

  it("returns null when min > max (corrupt attr)", () => {
    expect(extractStats({ valid_min: 100, valid_max: 50 })).toBeNull();
  });
});
