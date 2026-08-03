import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, expect, it, vi } from "vitest";
import { system } from "../../theme";
import { ChapterTypePicker } from "../ChapterTypePicker";

describe("ChapterTypePicker", () => {
  it("reveals specialized types on request", () => {
    render(
      <ChakraProvider value={system}>
        <ChapterTypePicker value="map" onChange={vi.fn()} />
      </ChakraProvider>
    );

    expect(screen.queryByRole("button", { name: /3D flyover/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More chapter types" }));
    expect(screen.getByRole("button", { name: /3D flyover/i })).toBeTruthy();
  });

  it("keeps a selected specialized type visible", () => {
    render(
      <ChakraProvider value={system}>
        <ChapterTypePicker value="flyover" onChange={vi.fn()} />
      </ChakraProvider>
    );
    expect(screen.getByRole("button", { name: /3D flyover/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
