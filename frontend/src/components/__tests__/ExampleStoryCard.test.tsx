import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ExampleStoryCard } from "../ExampleStoryCard";

function renderCard(props: React.ComponentProps<typeof ExampleStoryCard>) {
  return render(
    <ChakraProvider value={system}>
      <ExampleStoryCard {...props} />
    </ChakraProvider>
  );
}

describe("ExampleStoryCard", () => {
  it("renders the story title", () => {
    renderCard({
      title: "Arctic ice loss",
      chapterCount: 4,
      dataType: "Raster",
      onClick: () => {},
    });
    expect(screen.getByText("Arctic ice loss")).toBeInTheDocument();
  });

  it("renders the data-type and chapter-count subtitle", () => {
    renderCard({
      title: "Arctic ice loss",
      chapterCount: 4,
      dataType: "Raster",
      onClick: () => {},
    });
    expect(screen.getByText(/raster · 4 chapters/i)).toBeInTheDocument();
  });

  it("calls onClick when the card is activated", async () => {
    const handler = vi.fn();
    renderCard({
      title: "Arctic ice loss",
      chapterCount: 4,
      dataType: "Raster",
      onClick: handler,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /arctic ice loss/i }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when loading=true", async () => {
    const handler = vi.fn();
    renderCard({
      title: "Arctic ice loss",
      chapterCount: 4,
      dataType: "Raster",
      onClick: handler,
      loading: true,
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /arctic ice loss/i }));
    expect(handler).not.toHaveBeenCalled();
  });

  it("uses singular 'chapter' when chapterCount is 1", () => {
    renderCard({
      title: "T",
      chapterCount: 1,
      dataType: "Vector",
      onClick: () => {},
    });
    expect(screen.getByText(/vector · 1 chapter$/i)).toBeInTheDocument();
  });
});
