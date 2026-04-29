import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadPortableConfig } from "../loadPortableConfig";

const sampleConfig = {
  version: "1",
  origin: { story_id: "s1", workspace_id: null, exported_at: "2026-04-28T00:00:00Z" },
  metadata: { title: "T", description: null, author: null, created: "", updated: "" },
  chapters: [],
  layers: {},
  assets: {},
};

describe("loadPortableConfig", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("fetches and parses a config from a URL", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => sampleConfig,
    });
    const result = await loadPortableConfig("https://example.com/cng-rc.json");
    expect(global.fetch).toHaveBeenCalledWith("https://example.com/cng-rc.json");
    expect(result.version).toBe("1");
  });

  it("decodes a base64url-inlined config", async () => {
    const encoded = btoa(JSON.stringify(sampleConfig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const result = await loadPortableConfig(`base64url:${encoded}`);
    expect(result.metadata.title).toBe("T");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("throws a typed error on fetch failure", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 403 });
    await expect(loadPortableConfig("https://example.com/x.json")).rejects.toThrow(/403/);
  });

  it("throws on non-https URLs", async () => {
    await expect(loadPortableConfig("http://insecure.example.com/x.json")).rejects.toThrow();
  });

  it("throws on malformed base64url payloads", async () => {
    await expect(loadPortableConfig("base64url:!!!notbase64!!!")).rejects.toThrow();
  });
});
