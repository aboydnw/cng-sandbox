import { describe, it, expect } from "vitest";
import { pickRenderPath } from "../pickRenderPath";

describe("pickRenderPath", () => {
  it("picks client for small files under feature cap", () => {
    expect(pickRenderPath({ sizeBytes: 8_000_000, featureCount: 10_000 })).toBe("client");
  });

  it("picks server when over size threshold", () => {
    expect(pickRenderPath({ sizeBytes: 80_000_000, featureCount: 100_000 })).toBe("server");
  });

  it("picks server when over feature cap", () => {
    expect(pickRenderPath({ sizeBytes: 8_000_000, featureCount: 700_000 })).toBe("server");
  });

  it("defaults to server when size is unknown", () => {
    expect(pickRenderPath({ sizeBytes: null, featureCount: 10_000 })).toBe("server");
  });

  it("thresholds are overridable", () => {
    expect(
      pickRenderPath(
        { sizeBytes: 10_000_000, featureCount: 10_000 },
        { sizeThreshold: 5_000_000, featureThreshold: 500_000 }
      )
    ).toBe("server");
  });
});
