import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadInteractiveExport } from "../downloadInteractive";

const { captureMock, fetchMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("../../archival/captureMap", () => ({
  captureChapterMap: (...args: unknown[]) => captureMock(...args),
}));

beforeEach(() => {
  fetchMock.mockReset();
  captureMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function zipResponse() {
  return new Response("PK\x03\x04", {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": 'attachment; filename="story.zip"',
    },
  });
}

describe("downloadInteractiveExport", () => {
  it("captures one PNG per scrollytelling chapter and posts as FormData", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          version: "1",
          chapters: [
            { id: "s1", type: "scrollytelling" },
            { id: "m1", type: "map" },
          ],
          layers: {},
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          id: "story-1",
          chapters: [
            { id: "s1", type: "scrollytelling" },
            { id: "m1", type: "map" },
          ],
        })
      )
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(zipResponse());

    captureMock.mockResolvedValue(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    );

    const clickSpy = vi.fn();
    HTMLAnchorElement.prototype.click = clickSpy;
    global.URL.createObjectURL = vi.fn(() => "blob:fake");
    global.URL.revokeObjectURL = vi.fn();

    await downloadInteractiveExport("story-1", "My Story");

    const interactiveCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/export/interactive")
    );
    expect(interactiveCall).toBeDefined();
    const init = interactiveCall![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    const fd = init.body as FormData;
    const files = fd.getAll("scrolly_pngs");
    expect(files).toHaveLength(1);
    expect((files[0] as File).name).toBe("s1.png");
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("throws when the endpoint returns non-200", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ version: "1", chapters: [], layers: {} })
      )
      .mockResolvedValueOnce(jsonResponse({ id: "story-1", chapters: [] }))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response("Internal error", { status: 500 }));

    await expect(downloadInteractiveExport("story-1", "x")).rejects.toThrow(
      /500/
    );
  });
});
