import { describe, it, expect, vi } from "vitest";

vi.mock("../../lib/layers/cogLayer", () => ({
  buildCogLayerContinuous: vi.fn(() => []),
  buildCogLayerPaletted: vi.fn(() => []),
}));

import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { PublishDialog } from "../PublishDialog";
import * as bundle from "../../lib/story/buildStaticBundle";

const story = {
  id: "s1",
  title: "T",
  description: "",
  chapters: [],
  published: true,
  created_at: "",
  updated_at: "",
  dataset_id: null,
  dataset_ids: [],
};

describe("PublishDialog static bundle", () => {
  it("calls buildAndDownloadBundle when the user clicks the button", async () => {
    const spy = vi.spyOn(bundle, "buildAndDownloadBundle").mockResolvedValue();

    render(
      <ChakraProvider value={defaultSystem}>
        <PublishDialog
          open
          story={story}
          shareUrl="/"
          onPublish={() => {}}
          onClose={() => {}}
        />
      </ChakraProvider>
    );

    fireEvent.click(
      screen.getByRole("button", { name: /download static bundle/i })
    );
    expect(spy).toHaveBeenCalledWith("s1", "T");
  });
});
