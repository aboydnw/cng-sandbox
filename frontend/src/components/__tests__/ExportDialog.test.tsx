import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ExportDialog } from "../ExportDialog";
import type { Story } from "../../lib/story";

vi.mock("../../lib/story/buildStaticBundle", () => ({
  buildAndDownloadBundle: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/story/exportConfig", () => ({
  downloadStoryConfig: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../lib/story/archival/downloadArchival", () => ({
  downloadArchivalHtml: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../EmbedSnippet", () => ({
  EmbedSnippet: () => <div data-testid="embed-snippet" />,
}));
vi.mock("../ExportProgress", () => ({
  ExportProgress: ({ open }: { open: boolean }) =>
    open ? <div data-testid="export-progress" /> : null,
}));

const story = {
  id: "s-1",
  title: "Demo",
  description: null,
  dataset_id: null,
  dataset_ids: [],
  chapters: [],
  published: false,
  is_example: false,
} as unknown as Story;

function renderDialog(open: boolean, onClose = vi.fn()) {
  return render(
    <ChakraProvider value={system}>
      <ExportDialog open={open} onClose={onClose} story={story} />
    </ChakraProvider>
  );
}

describe("ExportDialog", () => {
  it("renders export entry points when open", () => {
    renderDialog(true);
    expect(
      screen.getByRole("button", { name: /download static bundle/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download archival html/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /download interactive bundle/i })
    ).toBeInTheDocument();
  });

  it("does not render content when closed", () => {
    renderDialog(false);
    expect(
      screen.queryByRole("button", { name: /download static bundle/i })
    ).toBeNull();
  });

  it("calls onClose when the close affordance fires", () => {
    const onClose = vi.fn();
    renderDialog(true, onClose);
    const closeBtn = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
