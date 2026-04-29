import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import StoryReaderPage from "../StoryReaderPage";
import type { CngRcConfig } from "../../lib/story/cngRcTypes";

vi.mock("../../lib/story/loadPortableConfig", () => ({
  loadPortableConfig: vi.fn(),
}));

vi.mock("../../lib/layers/cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => []),
  buildCogLayerPaletted: vi.fn(() => []),
}));

vi.mock("../../components/StoryRenderer", () => ({
  StoryRenderer: ({
    story,
  }: {
    story: { title: string; chapters: { id: string; title?: string }[] };
  }) => (
    <div data-testid="story-renderer">
      <h1>{story.title}</h1>
      {story.chapters.map((ch) => (
        <div key={ch.id}>{ch.title ?? ch.id}</div>
      ))}
    </div>
  ),
}));

import { loadPortableConfig } from "../../lib/story/loadPortableConfig";

function makePortableConfig(overrides: Partial<CngRcConfig> = {}): CngRcConfig {
  return {
    version: "1",
    origin: {
      story_id: "portable-story-1",
      workspace_id: null,
      exported_at: "2026-04-29T00:00:00Z",
    },
    metadata: {
      title: "Portable Story Title",
      description: "Loaded from portable config",
      author: null,
      created: "2026-04-20T00:00:00Z",
      updated: "2026-04-21T00:00:00Z",
    },
    chapters: [
      {
        id: "ch-1",
        type: "prose",
        title: "Chapter One",
        body: "Hello from portable mode",
        map: null,
        layers: [],
      },
    ],
    layers: {},
    assets: {},
    ...overrides,
  };
}

function renderAt(initialEntry: string) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/story/:id/embed" element={<StoryReaderPage embed />} />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "story-1",
          title: "API Story Title",
          description: "From API",
          dataset_id: null,
          dataset_ids: [],
          chapters: [],
          published: true,
          created_at: "2026-04-01T00:00:00Z",
          updated_at: "2026-04-02T00:00:00Z",
        }),
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StoryReaderPage portable embed", () => {
  it("renders a story from ?config= without calling /api/stories", async () => {
    vi.mocked(loadPortableConfig).mockResolvedValueOnce(makePortableConfig());

    renderAt(
      "/story/ignored/embed?config=" +
        encodeURIComponent("https://example.com/cng-rc.json")
    );

    await waitFor(() => {
      expect(screen.getByText("Chapter One")).toBeTruthy();
    });

    expect(loadPortableConfig).toHaveBeenCalledWith(
      "https://example.com/cng-rc.json"
    );

    const fetchMock = vi.mocked(globalThis.fetch);
    const calledStoryUrls = fetchMock.mock.calls.filter(([url]) =>
      typeof url === "string" ? url.includes("/api/stories/") : false
    );
    expect(calledStoryUrls).toHaveLength(0);
  });

  it("falls back to API fetch when ?config= is absent", async () => {
    renderAt("/story/story-1/embed");

    await waitFor(() => {
      const fetchMock = vi.mocked(globalThis.fetch);
      const matched = fetchMock.mock.calls.find(([url]) =>
        typeof url === "string" ? url.includes("/api/stories/story-1") : false
      );
      expect(matched).toBeTruthy();
    });

    expect(loadPortableConfig).not.toHaveBeenCalled();
  });

  it("shows a friendly error when config load fails", async () => {
    vi.mocked(loadPortableConfig).mockRejectedValueOnce(new Error("403"));

    renderAt(
      "/story/ignored/embed?config=" +
        encodeURIComponent("https://example.com/missing.json")
    );

    await waitFor(() => {
      expect(screen.getByText(/couldn't load this story/i)).toBeTruthy();
    });
  });
});
