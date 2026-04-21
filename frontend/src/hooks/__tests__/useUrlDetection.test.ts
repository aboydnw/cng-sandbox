import { describe, it, expect, vi } from "vitest";
import { detectUrlRoute } from "../useUrlDetection";

describe("detectUrlRoute", () => {
  it("routes {z}/{x}/{y} templates to xyz picker (rule 1)", async () => {
    const result = await detectUrlRoute("https://tile.osm.org/{z}/{x}/{y}.png");
    expect(result.route).toBe("xyz");
  });

  it("routes {x}/{y}/{z} variant to xyz picker (rule 1)", async () => {
    const result = await detectUrlRoute("https://example.com/{x}/{y}/{z}");
    expect(result.route).toBe("xyz");
  });

  it("routes .pmtiles URLs to pmtiles connection (rule 2)", async () => {
    const inspect = vi.fn().mockResolvedValue({
      format: "pmtiles",
      is_cog: false,
      size_bytes: null,
    });
    const result = await detectUrlRoute(
      "https://cdn.example.com/tiles.pmtiles",
      { inspect }
    );
    expect(result.route).toBe("pmtiles");
  });

  it("routes .parquet URLs to geoparquet modal (rule 3)", async () => {
    const result = await detectUrlRoute("https://cdn.example.com/data.parquet");
    expect(result.route).toBe("parquet");
  });

  it("routes .cog URLs to COG connection (rule 4)", async () => {
    const inspect = vi
      .fn()
      .mockResolvedValue({ format: "cog", is_cog: true, size_bytes: null });
    const result = await detectUrlRoute("https://cdn.example.com/raster.cog", {
      inspect,
    });
    expect(result.route).toBe("cog");
  });

  it("routes .tif URLs that are_cog=true to COG connection (rule 4)", async () => {
    const inspect = vi
      .fn()
      .mockResolvedValue({ format: "tiff", is_cog: true, size_bytes: null });
    const result = await detectUrlRoute("https://cdn.example.com/raster.tif", {
      inspect,
    });
    expect(result.route).toBe("cog");
  });

  it("routes .tif URLs that are not COGs to convert-url (rule 5)", async () => {
    const inspect = vi
      .fn()
      .mockResolvedValue({ format: "tiff", is_cog: false, size_bytes: null });
    const result = await detectUrlRoute("https://cdn.example.com/plain.tif", {
      inspect,
    });
    expect(result.route).toBe("convert-url");
  });

  it("routes .geojson URLs to convert-url (rule 5)", async () => {
    const result = await detectUrlRoute(
      "https://cdn.example.com/points.geojson"
    );
    expect(result.route).toBe("convert-url");
  });

  it("routes unknown URLs to discover flow (rule 6)", async () => {
    const inspect = vi.fn().mockResolvedValue({
      format: "unknown",
      is_cog: false,
      size_bytes: null,
    });
    const result = await detectUrlRoute("https://cdn.example.com/prefix/", {
      inspect,
    });
    expect(result.route).toBe("discover");
  });

  it("preserves the original url in the result", async () => {
    const result = await detectUrlRoute("https://example.com/data.parquet");
    expect(result.url).toBe("https://example.com/data.parquet");
  });
});
