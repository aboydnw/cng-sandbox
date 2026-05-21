import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ExportSection } from "../ExportSection";
import type { Story } from "../../lib/story";

vi.mock("../../lib/story/buildStaticBundle", () => ({
  buildAndDownloadBundle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/story/exportConfig", () => ({
  downloadStoryConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../EmbedSnippet", () => ({
  EmbedSnippet: () => <div data-testid="embed-snippet" />,
}));

const baseStory = {
  id: "s-1",
  title: "Demo",
  description: null,
  dataset_id: null,
  dataset_ids: [],
  chapters: [],
  published: false,
  is_example: false,
} as unknown as Story;

function renderSection(
  props: Partial<React.ComponentProps<typeof ExportSection>> = {}
) {
  return render(
    <ChakraProvider value={system}>
      <ExportSection
        story={baseStory}
        onArchival={vi.fn()}
        onInteractive={vi.fn()}
        {...props}
      />
    </ChakraProvider>
  );
}

describe("ExportSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the five export entry points", () => {
    renderSection();
    expect(
      screen.getByRole("button", { name: /download raw config/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download static bundle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download archival html/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download interactive bundle/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("embed-snippet")).toBeInTheDocument();
  });

  it("clicking 'Download static bundle' invokes buildAndDownloadBundle", async () => {
    renderSection();
    fireEvent.click(
      screen.getByRole("button", { name: /download static bundle/i })
    );
    const { buildAndDownloadBundle } =
      await import("../../lib/story/buildStaticBundle");
    expect(buildAndDownloadBundle).toHaveBeenCalledWith("s-1", "Demo");
  });

  it("clicking 'Download story config' invokes downloadStoryConfig", async () => {
    renderSection();
    fireEvent.click(
      screen.getByRole("button", { name: /download raw config/i })
    );
    const { downloadStoryConfig } =
      await import("../../lib/story/exportConfig");
    expect(downloadStoryConfig).toHaveBeenCalledWith("s-1", "Demo");
  });

  it("clicking 'Download archival HTML' calls onArchival", () => {
    const onArchival = vi.fn();
    renderSection({ onArchival });
    fireEvent.click(
      screen.getByRole("button", { name: /download archival html/i })
    );
    expect(onArchival).toHaveBeenCalled();
  });

  it("clicking 'Download interactive bundle' calls onInteractive", () => {
    const onInteractive = vi.fn();
    renderSection({ onInteractive });
    fireEvent.click(
      screen.getByRole("button", { name: /download interactive bundle/i })
    );
    expect(onInteractive).toHaveBeenCalled();
  });
});
