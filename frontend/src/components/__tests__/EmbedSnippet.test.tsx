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
          storyTitle="Test Story"
          configUrl="https://source.coop/foo/cng-rc.json"
        />
      </ChakraProvider>
    );
    const code = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(code.value).toContain(
      'src="https://viewer.cng.devseed.com/story/test-story-1/embed?config=https%3A%2F%2Fsource.coop%2Ffoo%2Fcng-rc.json"'
    );
    expect(code.value).toContain(
      'style="width:100%;height:100vh;min-height:500px;border:0"'
    );
    expect(code.value).toContain('height="700"');
    expect(code.value).toContain('title="Test Story"');
    expect(code.value).toContain('loading="lazy"');
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
            storyTitle="Test Story"
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

  it("appends theme params to the embed URL when a theme is set", () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <EmbedSnippet
          viewerOrigin="https://viewer.cng.devseed.com"
          storyId="test-story-1"
          storyTitle="Test Story"
          configUrl="https://source.coop/foo/cng-rc.json"
          theme={{
            bodyFont: "Libre Baskerville",
            headingFont: "Archivo",
            accent: "#2f6f4f",
            bg: "#ffffff",
          }}
        />
      </ChakraProvider>
    );
    const code = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(code.value).toContain("bodyFont=Libre+Baskerville");
    expect(code.value).toContain("headingFont=Archivo");
    expect(code.value).toContain("accent=2f6f4f");
    expect(code.value).toContain("bg=ffffff");
  });

  it("omits theme params when no theme is set", () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <EmbedSnippet
          viewerOrigin="https://viewer.cng.devseed.com"
          storyId="test-story-1"
          storyTitle="Test Story"
          configUrl="https://source.coop/foo/cng-rc.json"
        />
      </ChakraProvider>
    );
    const code = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(code.value).not.toContain("bodyFont");
    expect(code.value).not.toContain("accent");
  });
});
