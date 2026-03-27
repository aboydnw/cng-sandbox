import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStoryOnServer,
  getStoryFromServer,
  saveStoryToServer,
  deleteStoryFromServer,
} from "../api";
import { setWorkspaceId } from "../../api";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  setWorkspaceId("test1234");
});

describe("createStoryOnServer", () => {
  it("posts to /api/stories and returns the created story", async () => {
    const story = { title: "Test", dataset_id: "ds-1", chapters: [] };
    const response = {
      id: "s-1",
      ...story,
      published: false,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(response),
    });

    const result = await createStoryOnServer(
      story as Parameters<typeof createStoryOnServer>[0]
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/stories",
      expect.objectContaining({ method: "POST" })
    );
    expect(result.id).toBe("s-1");
  });
});

describe("getStoryFromServer", () => {
  it("fetches from /api/stories/:id", async () => {
    const story = { id: "s-1", title: "Test" };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(story),
    });

    const result = await getStoryFromServer("s-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/stories/s-1",
      expect.objectContaining({})
    );
    expect(result?.id).toBe("s-1");
  });

  it("returns null on 404", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await getStoryFromServer("missing");
    expect(result).toBeNull();
  });
});

describe("saveStoryToServer", () => {
  it("patches /api/stories/:id", async () => {
    const story = { id: "s-1", title: "Updated", chapters: [] };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(story),
    });

    await saveStoryToServer(story as Parameters<typeof saveStoryToServer>[0]);
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/stories/s-1",
      expect.objectContaining({ method: "PATCH" })
    );
  });
});

describe("deleteStoryFromServer", () => {
  it("deletes /api/stories/:id", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await deleteStoryFromServer("s-1");
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/stories/s-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
