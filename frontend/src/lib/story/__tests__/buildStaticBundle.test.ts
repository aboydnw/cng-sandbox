import { describe, it, expect, vi, beforeEach } from "vitest";
import JSZip from "jszip";
import { buildAndDownloadBundle } from "../buildStaticBundle";

describe("buildAndDownloadBundle", () => {
  let receivedBlob: Blob | null;

  beforeEach(() => {
    receivedBlob = null;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url === "/viewer/manifest.json") {
        return Promise.resolve({
          ok: true,
          json: async () => ({ files: ["viewer.html", "chunk-abc.js"] }),
        });
      }
      if (url === "/viewer/viewer.html") {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () =>
            Buffer.from(
              "<html>VIEWER</html>",
              "utf8"
            ) as unknown as ArrayBuffer,
        });
      }
      if (url === "/viewer/chunk-abc.js") {
        return Promise.resolve({
          ok: true,
          arrayBuffer: async () =>
            Buffer.from(
              "console.log('chunk');",
              "utf8"
            ) as unknown as ArrayBuffer,
        });
      }
      if (url === "/api/stories/s1/export/config") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            version: "1",
            origin: { story_id: "s1", workspace_id: null, exported_at: "" },
            metadata: {
              title: "Test Story",
              description: null,
              author: null,
              created: "",
              updated: "",
            },
            chapters: [],
            layers: {},
            assets: {},
          }),
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });

    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      receivedBlob = blob;
      return "blob:zip";
    }) as never;
    global.URL.revokeObjectURL = vi.fn();

    const HTMLAnchor = window.HTMLAnchorElement.prototype;
    vi.spyOn(HTMLAnchor, "click").mockImplementation(() => {});
  });

  it("rejects when a fetch fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(buildAndDownloadBundle("s1", "Test Story")).rejects.toThrow(
      /404/
    );
  });

  it("rejects when the manifest is malformed", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: "not-an-array" }),
    });
    await expect(buildAndDownloadBundle("s1", "Test Story")).rejects.toThrow(
      /Invalid viewer manifest/
    );
  });

  it("rejects when the manifest is missing viewer.html", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ files: ["chunk-abc.js"] }),
    });
    await expect(buildAndDownloadBundle("s1", "Test Story")).rejects.toThrow(
      /missing viewer\.html/
    );
  });

  it("zips viewer files (renamed to index.html) + cng-rc.json", async () => {
    await buildAndDownloadBundle("s1", "Test Story");

    expect(receivedBlob).not.toBeNull();
    const zip = await JSZip.loadAsync(receivedBlob!);
    expect(Object.keys(zip.files).sort()).toEqual([
      "chunk-abc.js",
      "cng-rc.json",
      "index.html",
    ]);
    expect(await zip.files["index.html"].async("string")).toContain("VIEWER");
    expect(await zip.files["chunk-abc.js"].async("string")).toContain(
      "console.log"
    );
    const config = JSON.parse(await zip.files["cng-rc.json"].async("string"));
    expect(config.origin.story_id).toBe("s1");
  });
});
