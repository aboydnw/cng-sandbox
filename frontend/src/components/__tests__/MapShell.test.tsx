import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { BasemapPicker } from "../MapShell";

describe("BasemapPicker", () => {
  it("exposes text labels and a non-color selected state", () => {
    render(
      <ChakraProvider value={system}>
        <BasemapPicker value="dark" onChange={vi.fn()} />
      </ChakraProvider>
    );

    expect(screen.getByText("Satellite")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dark basemap" })
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("changes basemap from its named button", () => {
    const onChange = vi.fn();
    render(
      <ChakraProvider value={system}>
        <BasemapPicker value="streets" onChange={onChange} />
      </ChakraProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Satellite basemap" }));
    expect(onChange).toHaveBeenCalledWith("imagery");
  });
});
