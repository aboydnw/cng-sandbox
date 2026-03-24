import { describe, it, expect } from "vitest";
import { toAbsoluteUrl } from "../url";

describe("toAbsoluteUrl", () => {
  it("returns full URLs unchanged", () => {
    expect(toAbsoluteUrl("https://pub-xxx.r2.dev/datasets/abc/file.tif"))
      .toBe("https://pub-xxx.r2.dev/datasets/abc/file.tif");
  });

  it("prepends window.location.origin to relative paths", () => {
    expect(toAbsoluteUrl("/storage/datasets/abc/file.tif"))
      .toBe("http://localhost/storage/datasets/abc/file.tif");
  });

  it("handles http URLs", () => {
    expect(toAbsoluteUrl("http://example.com/data.pmtiles"))
      .toBe("http://example.com/data.pmtiles");
  });
});
