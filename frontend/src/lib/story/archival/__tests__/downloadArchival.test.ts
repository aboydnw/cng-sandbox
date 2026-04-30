import { afterEach, describe, it, expect, vi } from "vitest";
import { downloadArchivalHtml } from "../downloadArchival";

vi.mock("../buildArchivalHtml", () => ({
  buildArchivalHtml: vi
    .fn()
    .mockResolvedValue("<!doctype html><html>archival</html>"),
}));

const originalCreateObjectURL = global.URL.createObjectURL;
const originalRevokeObjectURL = global.URL.revokeObjectURL;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  global.URL.createObjectURL = originalCreateObjectURL;
  global.URL.revokeObjectURL = originalRevokeObjectURL;
});

describe("downloadArchivalHtml", () => {
  it("fetches the config, builds the HTML, and triggers download", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: "1",
        origin: { story_id: "s1", workspace_id: null, exported_at: "" },
        metadata: {
          title: "Story",
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
    vi.stubGlobal("fetch", fetchMock);

    const click = vi.fn();
    global.URL.createObjectURL = vi.fn(() => "blob:html");
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation(() => {
      return {
        click,
        set href(_v: string) {},
        set download(_v: string) {},
      } as never;
    });

    await downloadArchivalHtml("s1", "Story");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/stories/s1/export/config",
      expect.objectContaining({ signal: undefined })
    );
    expect(click).toHaveBeenCalled();
  });

  it("aborts when the supplied signal fires", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async (_, opts) => {
      controller.abort();
      return {
        ok: true,
        json: async () => ({
          version: "1",
          origin: { story_id: "s1", workspace_id: null, exported_at: "" },
          metadata: {
            title: "Story",
            description: null,
            author: null,
            created: "",
            updated: "",
          },
          chapters: [],
          layers: {},
          assets: {},
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadArchivalHtml("s1", "Story", undefined, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
