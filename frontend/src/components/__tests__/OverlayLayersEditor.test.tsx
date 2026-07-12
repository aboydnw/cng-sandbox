import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { OverlayLayersEditor } from "../OverlayLayersEditor";
import type { Dataset, Connection } from "../../types";

const ds = {
  id: "ds-v",
  filename: "parks.geojson",
  dataset_type: "vector",
} as unknown as Dataset;

function renderEditor(
  overlays = [{ dataset_id: "ds-v", opacity: 1, visible: true }]
) {
  const onChange = vi.fn();
  const onAddClick = vi.fn();
  render(
    <ChakraProvider value={defaultSystem}>
      <OverlayLayersEditor
        overlays={overlays}
        datasets={[ds]}
        connections={[] as Connection[]}
        onChange={onChange}
        onAddClick={onAddClick}
      />
    </ChakraProvider>
  );
  return { onChange, onAddClick };
}

describe("OverlayLayersEditor", () => {
  it("renders a row per overlay with its resolved name", () => {
    renderEditor();
    expect(screen.getByText(/parks\.geojson/i)).toBeInTheDocument();
  });

  it("removes an overlay", () => {
    const { onChange } = renderEditor();
    fireEvent.click(screen.getByLabelText(/remove overlay/i));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("calls onAddClick from the add button", () => {
    const { onAddClick } = renderEditor([]);
    fireEvent.click(screen.getByRole("button", { name: /add overlay/i }));
    expect(onAddClick).toHaveBeenCalled();
  });
});
