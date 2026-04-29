import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/layers/cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => []),
  buildCogLayerPaletted: vi.fn(() => []),
}));

import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { PublishDialog } from "../PublishDialog";
import * as exportConfig from "../../lib/story/exportConfig";

const mockStory = {
  id: "story-1",
  title: "Coastal Erosion 2024",
  description: "Test",
  chapters: [
    {
      id: "c1",
      order: 0,
      type: "prose" as const,
      title: "Intro",
      narrative: "",
    },
  ],
  published: true,
  created_at: "",
  updated_at: "",
  dataset_id: null,
  dataset_ids: [],
};

describe("PublishDialog Export section", () => {
  it("calls downloadStoryConfig with the story id and title when the button is clicked", async () => {
    const spy = vi
      .spyOn(exportConfig, "downloadStoryConfig")
      .mockResolvedValue();

    render(
      <ChakraProvider value={defaultSystem}>
        <PublishDialog
          open
          story={mockStory}
          shareUrl="/story/story-1"
          onPublish={() => {}}
          onClose={() => {}}
        />
      </ChakraProvider>
    );

    const button = screen.getByRole("button", {
      name: /download story config/i,
    });
    fireEvent.click(button);

    expect(spy).toHaveBeenCalledWith("story-1", "Coastal Erosion 2024");
  });
});
