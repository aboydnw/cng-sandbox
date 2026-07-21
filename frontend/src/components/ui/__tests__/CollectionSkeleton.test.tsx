import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, expect, it } from "vitest";
import { system } from "../../../theme";
import { CollectionSkeleton } from "../CollectionSkeleton";

describe("CollectionSkeleton", () => {
  it("exposes a stable loading region", () => {
    render(
      <ChakraProvider value={system}>
        <CollectionSkeleton rows={3} />
      </ChakraProvider>
    );

    const region = screen.getByLabelText("Loading content");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region.children).toHaveLength(3);
  });
});
