import { describe, expect, it } from "vitest";
import { sourceCoopCatalog, getProduct } from "../sourceCoopCatalog";

describe("sourceCoopCatalog", () => {
  it("has exactly three v1 entries", () => {
    expect(sourceCoopCatalog).toHaveLength(3);
    const slugs = sourceCoopCatalog.map((p) => p.slug);
    expect(slugs).toEqual(
      expect.arrayContaining([
        "ausantarctic/ghrsst-mur-v2",
        "alexgleith/gebco-2024",
        "vizzuality/lg-land-carbon-data",
      ])
    );
  });

  it("every product has a name, description, thumbnail, and tags", () => {
    for (const p of sourceCoopCatalog) {
      expect(p.name).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.thumbnail).toBeTruthy();
      expect(Array.isArray(p.tags)).toBe(true);
    }
  });

  it("getProduct returns the matching entry", () => {
    const p = getProduct("alexgleith/gebco-2024");
    expect(p.name).toContain("GEBCO");
  });

  it("getProduct throws for unknown slug", () => {
    expect(() => getProduct("nobody/nothing")).toThrow();
  });

  it("GHRSST is marked temporal", () => {
    const p = getProduct("ausantarctic/ghrsst-mur-v2");
    expect(p.isTemporal).toBe(true);
  });

  it("GEBCO and lg-land-carbon-data are not temporal", () => {
    expect(getProduct("alexgleith/gebco-2024").isTemporal).toBe(false);
    expect(getProduct("vizzuality/lg-land-carbon-data").isTemporal).toBe(false);
  });
});
