import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ChapterList } from "../ChapterList";
import type { Chapter } from "../../lib/story";

const chapters: Chapter[] = [
  {
    id: "ready",
    order: 0,
    type: "prose",
    title: "Opening",
    narrative: "Context",
  },
  { id: "draft", order: 1, type: "prose", title: "Finding", narrative: "" },
];

function renderList(over = {}) {
  const props = {
    chapters,
    activeChapterId: "ready",
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
    ...over,
  };
  render(
    <ChakraProvider value={system}>
      <ChapterList {...props} />
    </ChakraProvider>
  );
  return props;
}

describe("ChapterList polished states", () => {
  it("communicates selected and incomplete states without color alone", () => {
    renderList();
    expect(
      screen.getByRole("button", { name: /chapter 1.*ready/i })
    ).toHaveAttribute("aria-current", "step");
    expect(
      screen.getByRole("button", { name: /chapter 2.*reader-facing text/i })
    ).toBeInTheDocument();
  });

  it("selects a chapter with the keyboard and names reorder actions", () => {
    const props = renderList();
    const draft = screen.getByRole("button", { name: /chapter 2/i });
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(props.onSelect).toHaveBeenCalledWith("draft");
    expect(
      screen.getByRole("button", { name: /move finding up/i })
    ).toBeInTheDocument();
  });

  it("does not select a chapter when a nested control handles the key", () => {
    const props = renderList();
    const moveUp = screen.getByRole("button", { name: /move finding up/i });
    fireEvent.keyDown(moveUp, { key: "Enter" });
    expect(props.onSelect).not.toHaveBeenCalled();
  });
});
