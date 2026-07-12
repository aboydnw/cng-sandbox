import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const storyFixture = {
  id: "s1",
  title: "S",
  description: "",
  dataset_id: null,
  dataset_ids: [],
  published: false,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  chapters: [
    {
      id: "ch1",
      order: 0,
      type: "map",
      title: "M",
      narrative: "",
      map_state: {
        center: [0, 0],
        zoom: 2,
        bearing: 0,
        pitch: 0,
        basemap: "streets",
      },
      layer_config: {
        dataset_id: "ds-1",
        colormap: "viridis",
        opacity: 0.8,
        basemap: "streets",
      },
      overlays: [],
    },
  ],
};

vi.mock("react-router-dom", () => ({
  useParams: () => ({ id: "s1" }),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useNavigate: () => vi.fn(),
}));

vi.mock("../useWorkspace", () => ({
  useWorkspace: () => ({ workspacePath: (p: string) => p }),
}));

vi.mock("../../lib/api", () => ({
  workspaceFetch: vi.fn(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve([]) })
  ),
  connectionsApi: { list: vi.fn(() => Promise.resolve([])) },
}));

vi.mock("../../lib/story", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/story")>("../../lib/story");
  return {
    ...actual,
    getStoryFromServer: vi.fn(() =>
      Promise.resolve(JSON.parse(JSON.stringify(storyFixture)))
    ),
    saveStoryToServer: vi.fn(() => Promise.resolve(storyFixture)),
    createStoryOnServer: vi.fn(() => Promise.resolve(storyFixture)),
  };
});

import { useStoryEditor } from "../useStoryEditor";

describe("updateChapterOverlays", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the active chapter's overlays", async () => {
    const { result } = renderHook(() => useStoryEditor());

    await waitFor(() => expect(result.current.story).not.toBeNull());

    act(() => {
      result.current.updateChapterOverlays([
        { dataset_id: "ds-v", opacity: 1, visible: true },
      ]);
    });

    const ch = result.current.story!.chapters[0];
    expect((ch as { overlays?: unknown[] }).overlays).toHaveLength(1);
  });
});
