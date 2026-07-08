import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { NarrativeEditor } from "../NarrativeEditor";
import { DEFAULT_LAYER_CONFIG, DEFAULT_MAP_STATE } from "../../lib/story";

function wrap(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const baseProps = {
  chapterType: "scrollytelling" as const,
  onChapterTypeChange: () => {},
  title: "T",
  narrative: "",
  onTitleChange: () => {},
  onNarrativeChange: () => {},
  onLayerConfigChange: () => {},
  datasetType: "raster" as const,
  datasets: [],
  connections: [],
  overlayPosition: "left" as const,
  onOverlayPositionChange: () => {},
};

describe("NarrativeEditor 3D section", () => {
  it("toggling the globe switch calls onMapStateChange with globe:true", () => {
    const onMapStateChange = vi.fn();
    const { getByLabelText } = wrap(
      <NarrativeEditor
        {...baseProps}
        layerConfig={{ ...DEFAULT_LAYER_CONFIG }}
        mapState={{ ...DEFAULT_MAP_STATE }}
        onMapStateChange={onMapStateChange}
      />
    );
    fireEvent.click(getByLabelText(/globe/i));
    expect(onMapStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ globe: true })
    );
  });

  it("disables the terrain switch when the chapter has a bound dataset", () => {
    const { getByLabelText } = wrap(
      <NarrativeEditor
        {...baseProps}
        layerConfig={{ ...DEFAULT_LAYER_CONFIG, dataset_id: "ds-1" }}
        mapState={{ ...DEFAULT_MAP_STATE }}
        onMapStateChange={() => {}}
      />
    );
    const terrainSwitch = getByLabelText(/terrain/i) as HTMLInputElement;
    expect(terrainSwitch.disabled).toBe(true);
  });
});
