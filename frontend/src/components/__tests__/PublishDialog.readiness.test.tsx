import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/layers/cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => []),
  buildCogLayerPaletted: vi.fn(() => []),
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { PublishDialog } from "../PublishDialog";
import type { Story } from "../../lib/story";

const story: Story = {
  id: "story-1",
  title: "Coastlines",
  description: "",
  chapters: [
    {
      id: "chapter-1",
      order: 0,
      type: "prose",
      title: "Opening",
      narrative: "",
    },
  ],
  published: false,
  created_at: "",
  updated_at: "",
  dataset_id: null,
  dataset_ids: [],
};

function renderDialog(value: Story, onPublish = vi.fn()) {
  render(
    <ChakraProvider value={system}>
      <PublishDialog
        open
        story={value}
        shareUrl="/story/story-1"
        onPublish={onPublish}
        onClose={vi.fn()}
      />
    </ChakraProvider>
  );
  return onPublish;
}

describe("PublishDialog readiness", () => {
  it("shows advisories but permits an intentional publish", () => {
    const onPublish = renderDialog(story);
    expect(screen.getByText(/review before sharing/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^publish$/i }));
    expect(onPublish).toHaveBeenCalled();
  });

  it("disables publish when the story has no title", () => {
    const onPublish = renderDialog({ ...story, title: "" });
    expect(screen.getByText(/finish before publishing/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^publish$/i })).toBeDisabled();
    expect(onPublish).not.toHaveBeenCalled();
  });
});
