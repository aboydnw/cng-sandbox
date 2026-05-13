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

function dispatchFetch(url: string | URL | Request) {
  const path = typeof url === "string" ? url : url.toString();
  if (path.includes("/export/config")) {
    return Promise.resolve({
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
  }
  if (path.match(/\/api\/stories\/[^/]+$/)) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        id: "s1",
        title: "Story",
        dataset_id: null,
        dataset_ids: [],
        chapters: [],
        created_at: "",
        updated_at: "",
        published: false,
      }),
    });
  }
  if (path.endsWith("/api/datasets")) {
    return Promise.resolve({ ok: true, json: async () => [] });
  }
  if (path.endsWith("/api/connections")) {
    return Promise.resolve({ ok: true, json: async () => [] });
  }
  throw new Error(`unexpected fetch: ${path}`);
}

describe("downloadArchivalHtml", () => {
  it("fetches the config, builds the HTML, and triggers download", async () => {
    const fetchMock = vi.fn(dispatchFetch);
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

    const calledPaths = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(calledPaths).toEqual(
      expect.arrayContaining([
        "/api/stories/s1/export/config",
        "/api/stories/s1",
        "/api/datasets",
        "/api/connections",
      ])
    );
    expect(click).toHaveBeenCalled();
  });

  it("aborts when the supplied signal fires", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async (url) => {
      controller.abort();
      return dispatchFetch(url);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      downloadArchivalHtml("s1", "Story", undefined, controller.signal)
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
