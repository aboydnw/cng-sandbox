import { describe, it, expect } from "vitest";
import proj4 from "proj4";
import { generateUtmZones } from "../utm";

describe("generateUtmZones", () => {
  it("produces 120 entries (60 north + 60 south)", () => {
    const zones = generateUtmZones();
    expect(zones.size).toBe(120);
  });

  it("includes zone 14N (32614) and 14S (32714)", () => {
    const zones = generateUtmZones();
    expect(zones.has(32614)).toBe(true);
    expect(zones.has(32714)).toBe(true);
  });

  it("zone 14N is at central meridian -99°", () => {
    const zones = generateUtmZones();
    const def = zones.get(32614)!;
    const fwd = proj4("EPSG:4326", def as unknown as string);
    const point = fwd.forward([-99, 40]);
    expect(point[0]).toBeCloseTo(500000, 0);
  });

  it("zone 1N is at central meridian -177°", () => {
    const zones = generateUtmZones();
    const def = zones.get(32601)!;
    const fwd = proj4("EPSG:4326", def as unknown as string);
    const point = fwd.forward([-177, 0]);
    expect(point[0]).toBeCloseTo(500000, 0);
  });

  it("south-hemisphere zones have false northing 10,000,000", () => {
    const zones = generateUtmZones();
    const def = zones.get(32714)!;
    const fwd = proj4("EPSG:4326", def as unknown as string);
    const point = fwd.forward([-99, 0]);
    expect(point[1]).toBeCloseTo(10000000, 0);
  });
});
