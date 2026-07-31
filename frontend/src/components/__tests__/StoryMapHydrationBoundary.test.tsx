import { act, render, screen } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Story } from "../../lib/story";
import type { Dataset } from "../../types";

vi.mock("../UnifiedMap", () => ({
  UnifiedMap: () => <div data-testid="unified-map" />,
}));

interface ObserverRecord {
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
}

const observers: ObserverRecord[] = [];

class MockIntersectionObserver {
  readonly root = null;
  readonly rootMargin: string;
  readonly thresholds = [0];

  constructor(
    private readonly callback: IntersectionObserverCallback,
    options?: IntersectionObserverInit
  ) {
    this.rootMargin = options?.rootMargin ?? "0px";
    observers.push({ callback, options });
  }

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

const story = {
  id: "story-progressive",
  title: "Progressive story",
  dataset_id: null,
  dataset_ids: ["dataset-1"],
  published: true,
  created_at: "2026-07-31T00:00:00Z",
  updated_at: "2026-07-31T00:00:00Z",
  chapters: [
    {
      id: "prose-1",
      order: 0,
      type: "prose",
      title: "Read this first",
      narrative: "The introduction is available immediately.",
    },
    {
      id: "map-1",
      order: 1,
      type: "map",
      title: "Then explore the map",
      narrative: "This narrative is visible while the map prepares.",
      map_state: {
        center: [0, 0],
        zoom: 2,
        bearing: 0,
        pitch: 0,
        basemap: "streets",
      },
      layer_config: {
        dataset_id: "dataset-1",
        colormap: "viridis",
        opacity: 1,
        basemap: "streets",
      },
    },
  ],
} as unknown as Story;

const dataset = {
  id: "dataset-1",
  dataset_type: "raster",
  timesteps: [],
  tile_url: "/raster/tiles/{z}/{x}/{y}",
} as unknown as Dataset;

describe("Story map progressive hydration", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal(
      "IntersectionObserver",
      MockIntersectionObserver as unknown as typeof IntersectionObserver
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders story prose and a stable map placeholder before hydrating WebGL", async () => {
    const { StoryRenderer } = await import("../StoryRenderer");

    render(
      <ChakraProvider value={defaultSystem}>
        <StoryRenderer
          story={story}
          datasetMap={new Map([["dataset-1", dataset]])}
        />
      </ChakraProvider>
    );

    expect(screen.getByText("Read this first")).toBeInTheDocument();
    expect(
      screen.getByText("The introduction is available immediately.")
    ).toBeInTheDocument();
    expect(screen.getByText("Then explore the map")).toBeInTheDocument();
    expect(
      screen.getByText("This narrative is visible while the map prepares.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Preparing interactive map" })
    ).toBeInTheDocument();
    expect(screen.queryByTestId("unified-map")).not.toBeInTheDocument();

    expect(
      observers.some((entry) => entry.options?.rootMargin === "200% 0px")
    ).toBe(true);
    expect(
      observers.some((entry) => entry.options?.rootMargin === "100% 0px")
    ).toBe(true);

    const hydrationObserver = observers.find(
      (entry) => entry.options?.rootMargin === "100% 0px"
    );
    await act(async () => {
      hydrationObserver?.callback(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
    });

    expect(
      await screen.findByTestId("unified-map", {}, { timeout: 10_000 })
    ).toBeInTheDocument();
  }, 15_000);
});
