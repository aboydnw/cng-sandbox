import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { OverlayPicker } from "../OverlayPicker";
import type { Dataset, Connection } from "../../types";

const exampleConn = {
  id: "conn-admin",
  name: "Admin boundaries",
  connection_type: "pmtiles",
  tile_type: "vector",
  is_example_copy: true,
} as unknown as Connection;

describe("OverlayPicker", () => {
  it("lists example connections under the Examples tab and selects one", () => {
    const onSelect = vi.fn();
    render(
      <ChakraProvider value={defaultSystem}>
        <OverlayPicker
          open
          datasets={[] as Dataset[]}
          connections={[exampleConn]}
          onClose={vi.fn()}
          onSelect={onSelect}
        />
      </ChakraProvider>
    );
    fireEvent.click(screen.getByRole("tab", { name: /examples/i }));
    fireEvent.click(screen.getByText(/admin boundaries/i));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ connection_id: "conn-admin" })
    );
  });
});
