import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../api", () => ({
  workspaceFetch: vi.fn(),
}));

import { workspaceFetch } from "../../api";
import { forkStoryOnServer } from "../api";
import type { Story } from "../types";

describe("forkStoryOnServer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POSTs to /api/stories/<id>/fork and returns the parsed story", async () => {
    const forked: Story = {
      id: "new-id",
      title: "Forked",
      description: null,
      dataset_id: null,
      dataset_ids: [],
      chapters: [],
      published: false,
      is_example: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Story;
    (workspaceFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => forked,
    });
    const result = await forkStoryOnServer("source-id");
    expect(workspaceFetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/stories\/source-id\/fork$/),
      expect.objectContaining({ method: "POST" })
    );
    expect(result).toEqual(forked);
  });

  it("throws when the response is not ok", async () => {
    (workspaceFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });
    await expect(forkStoryOnServer("missing-id")).rejects.toThrow(/404/);
  });
});
