import { describe, it, expect, vi } from "vitest";
import { downloadArchivalHtml } from "../downloadArchival";

vi.mock("../buildArchivalHtml", () => ({
  buildArchivalHtml: vi
    .fn()
    .mockResolvedValue("<!doctype html><html>archival</html>"),
}));

describe("downloadArchivalHtml", () => {
  it("fetches the config, builds the HTML, and triggers download", async () => {
    global.fetch = vi.fn().mockResolvedValue({
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

    expect(global.fetch).toHaveBeenCalledWith("/api/stories/s1/export/config");
    expect(click).toHaveBeenCalled();
  });
});
