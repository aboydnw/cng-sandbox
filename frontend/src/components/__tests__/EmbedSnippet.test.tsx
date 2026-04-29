import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { EmbedSnippet } from "../EmbedSnippet";

describe("EmbedSnippet", () => {
  it("renders an iframe snippet pointing at /story/:id/embed with the config param", () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <EmbedSnippet
          viewerOrigin="https://viewer.cng.devseed.com"
          storyId="test-story-1"
          configUrl="https://source.coop/foo/cng-rc.json"
        />
      </ChakraProvider>
    );
    const code = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(code.value).toContain(
      'src="https://viewer.cng.devseed.com/story/test-story-1/embed?config=https%3A%2F%2Fsource.coop%2Ffoo%2Fcng-rc.json"'
    );
    expect(code.value).toContain('width="100%"');
    expect(code.value).toContain('height="600"');
  });

  it("writes the snippet to the clipboard when Copy is clicked", async () => {
    const originalClipboard = navigator.clipboard;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    try {
      render(
        <ChakraProvider value={defaultSystem}>
          <EmbedSnippet
            viewerOrigin="https://viewer.cng.devseed.com"
            storyId="test-story-1"
            configUrl="https://source.coop/foo/cng-rc.json"
          />
        </ChakraProvider>
      );

      const button = screen.getByRole("button", { name: /copy/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining(
            'src="https://viewer.cng.devseed.com/story/test-story-1/embed?config=https%3A%2F%2Fsource.coop%2Ffoo%2Fcng-rc.json"'
          )
        );
      });
    } finally {
      Object.assign(navigator, { clipboard: originalClipboard });
    }
  });
});
