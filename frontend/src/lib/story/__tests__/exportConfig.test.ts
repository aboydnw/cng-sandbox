import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadStoryConfig } from "../exportConfig";

describe("downloadStoryConfig", () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: "1",
        origin: {
          story_id: "story-1",
          workspace_id: "ws",
          exported_at: "2026-04-28T00:00:00Z",
        },
        metadata: {
          title: "My Story",
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
  });

  it("fetches the export endpoint and triggers a download", async () => {
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    global.URL.createObjectURL = createObjectURL;
    global.URL.revokeObjectURL = revokeObjectURL;

    const clickSpy = vi.fn();
    vi.spyOn(document, "createElement").mockImplementation(() => {
      return {
        click: clickSpy,
        set href(_v: string) {},
        set download(_v: string) {},
      } as never;
    });

    await downloadStoryConfig("story-1", "My Story");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/stories/story-1/export/config"
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("throws on non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(downloadStoryConfig("missing", "X")).rejects.toThrow();
  });
});
