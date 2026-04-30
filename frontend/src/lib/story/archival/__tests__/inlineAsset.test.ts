import { describe, it, expect, vi } from "vitest";
import { fetchAndInlineAsBase64 } from "../inlineAsset";

describe("fetchAndInlineAsBase64", () => {
  it("returns a data URL for a successful fetch", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob([bytes], { type: "image/png" }),
    });

    const result = await fetchAndInlineAsBase64("https://example.com/img.png");
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("throws on fetch failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchAndInlineAsBase64("https://example.com/missing.png")).rejects.toThrow();
  });
});
