import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ExampleStoryCard } from "../ExampleStoryCard";

function renderCard(props: React.ComponentProps<typeof ExampleStoryCard>) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <ExampleStoryCard {...props} />
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("ExampleStoryCard", () => {
  it("renders the story title", () => {
    renderCard({
      title: "Arctic ice loss",
      chapterCount: 4,
      dataType: "Raster",
      href: "/w/x/story/abc/edit",
    });
    expect(screen.getByText("Arctic ice loss")).toBeInTheDocument();
  });

  it("renders the data-type and chapter-count subtitle", () => {
    renderCard({
      title: "Arctic ice loss",
      chapterCount: 4,
      dataType: "Raster",
      href: "/w/x/story/abc/edit",
    });
    expect(screen.getByText(/raster · 4 chapters/i)).toBeInTheDocument();
  });

  it("links to the given href", () => {
    renderCard({
      title: "T",
      chapterCount: 1,
      dataType: "Vector",
      href: "/w/x/story/abc/edit",
    });
    const link = screen.getByRole("link", { name: /t/i });
    expect(link.getAttribute("href")).toBe("/w/x/story/abc/edit");
  });

  it("uses singular 'chapter' when chapterCount is 1", () => {
    renderCard({
      title: "T",
      chapterCount: 1,
      dataType: "Vector",
      href: "/x",
    });
    expect(screen.getByText(/vector · 1 chapter$/i)).toBeInTheDocument();
  });
});
