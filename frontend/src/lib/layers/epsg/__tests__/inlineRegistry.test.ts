import { describe, it, expect } from "vitest";
import { INLINE_REGISTRY } from "../inlineRegistry";

describe("INLINE_REGISTRY", () => {
  it("contains all 31 curated codes", () => {
    expect(INLINE_REGISTRY.has(4326)).toBe(true);
    expect(INLINE_REGISTRY.has(5070)).toBe(true);
    expect(INLINE_REGISTRY.has(2154)).toBe(true);
    expect(INLINE_REGISTRY.has(27700)).toBe(true);
  });

  it("contains all 120 UTM zones", () => {
    for (let zone = 1; zone <= 60; zone++) {
      expect(INLINE_REGISTRY.has(32600 + zone)).toBe(true);
      expect(INLINE_REGISTRY.has(32700 + zone)).toBe(true);
    }
  });

  it("has the expected total size (31 curated + 120 UTM)", () => {
    expect(INLINE_REGISTRY.size).toBe(31 + 120);
  });

  it("does not contain a known-uncommon code (8857 Equal Earth)", () => {
    expect(INLINE_REGISTRY.has(8857)).toBe(false);
  });
});
