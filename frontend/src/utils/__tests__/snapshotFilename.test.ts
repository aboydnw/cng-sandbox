import { describe, it, expect } from "vitest";
import { buildSnapshotFilename } from "../snapshotFilename";

describe("buildSnapshotFilename", () => {
  it("uses slugified title when provided and not temporal", () => {
    expect(buildSnapshotFilename({ title: "GEBCO Bathymetry" })).toBe(
      "gebco-bathymetry.png"
    );
  });

  it("appends timestep ISO date for temporal datasets", () => {
    expect(
      buildSnapshotFilename({
        title: "Sea Surface Temp",
        timestepIso: "2024-03-15T00:00:00Z",
      })
    ).toBe("sea-surface-temp-2024-03-15.png");
  });

  it("falls back to map-snapshot when title is missing", () => {
    expect(buildSnapshotFilename({})).toBe("map-snapshot.png");
  });

  it("falls back to map-snapshot when title slugifies to empty", () => {
    expect(buildSnapshotFilename({ title: "///" })).toBe("map-snapshot.png");
  });

  it("collapses repeated separators and trims dashes", () => {
    expect(buildSnapshotFilename({ title: "  Hello -- World!! " })).toBe(
      "hello-world.png"
    );
  });

  it("includes timestep date even when title falls back", () => {
    expect(
      buildSnapshotFilename({ timestepIso: "2024-03-15T00:00:00Z" })
    ).toBe("map-snapshot-2024-03-15.png");
  });
});
