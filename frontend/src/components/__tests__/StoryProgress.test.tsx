import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, expect, it } from "vitest";
import { system } from "../../theme";
import { StoryProgress } from "../StoryProgress";

describe("StoryProgress", () => {
  it("announces normalized reading progress", () => {
    render(
      <ChakraProvider value={system}>
        <StoryProgress progress={0.42} />
      </ChakraProvider>
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "42"
    );
  });

  it("clamps progress to the valid range", () => {
    render(
      <ChakraProvider value={system}>
        <StoryProgress progress={2} />
      </ChakraProvider>
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "100"
    );
  });
});
