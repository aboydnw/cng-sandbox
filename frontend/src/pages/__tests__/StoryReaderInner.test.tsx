import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, expect, it, vi } from "vitest";
import { system } from "../../theme";
import { StoryReaderInner } from "../StoryReaderInner";
import { createStory } from "../../lib/story";

vi.mock("../../components/StoryRenderer", () => ({
  StoryRenderer: () => <div>Story content</div>,
}));

vi.mock("../../lib/chat/useChatConfig", () => ({
  useChatConfig: () => ({ enabled: false }),
}));

describe("StoryReaderInner", () => {
  it("marks a non-scrollable story complete after layout", () => {
    render(
      <ChakraProvider value={system}>
        <StoryReaderInner
          story={createStory(null, { id: "story-1" })}
          datasetMap={new Map()}
          connectionMap={new Map()}
          embed
        />
      </ChakraProvider>
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });
});
