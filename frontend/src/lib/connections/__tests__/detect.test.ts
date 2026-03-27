import { describe, it, expect } from "vitest";
import { detectConnectionType, extractNameFromUrl } from "../detect";

describe("detectConnectionType", () => {
  it("detects .tif as cog", () => {
    expect(
      detectConnectionType("https://bucket.s3.amazonaws.com/scene.tif")
    ).toBe("cog");
  });

  it("detects .tiff as cog", () => {
    expect(detectConnectionType("https://example.com/data.tiff")).toBe("cog");
  });

  it("detects .pmtiles as pmtiles", () => {
    expect(detectConnectionType("https://example.com/tiles.pmtiles")).toBe(
      "pmtiles"
    );
  });

  it("detects XYZ template as xyz_raster", () => {
    expect(
      detectConnectionType("https://tiles.example.com/{z}/{x}/{y}.png")
    ).toBe("xyz_raster");
  });

  it("detects .mvt XYZ as xyz_vector", () => {
    expect(
      detectConnectionType("https://tiles.example.com/{z}/{x}/{y}.mvt")
    ).toBe("xyz_vector");
  });

  it("detects .pbf XYZ as xyz_vector", () => {
    expect(
      detectConnectionType("https://tiles.example.com/{z}/{x}/{y}.pbf")
    ).toBe("xyz_vector");
  });

  it("returns null for unknown URLs", () => {
    expect(detectConnectionType("https://example.com/some-api")).toBeNull();
  });

  it("handles query parameters after extension", () => {
    expect(
      detectConnectionType(
        "https://bucket.s3.amazonaws.com/scene.tif?token=abc"
      )
    ).toBe("cog");
  });
});

describe("extractNameFromUrl", () => {
  it("extracts filename from S3 URL", () => {
    expect(
      extractNameFromUrl("https://bucket.s3.amazonaws.com/path/scene.tif")
    ).toBe("scene.tif");
  });

  it("extracts hostname for XYZ URLs", () => {
    expect(
      extractNameFromUrl("https://tiles.example.com/{z}/{x}/{y}.png")
    ).toBe("tiles.example.com");
  });

  it("strips query parameters", () => {
    expect(extractNameFromUrl("https://bucket.com/file.pmtiles?token=x")).toBe(
      "file.pmtiles"
    );
  });

  it("handles empty string", () => {
    expect(extractNameFromUrl("")).toBe("");
  });
});
