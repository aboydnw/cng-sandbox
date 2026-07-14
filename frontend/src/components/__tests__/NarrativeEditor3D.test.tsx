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

  it("editing COPC color mode writes color_mode into layer_config", () => {
    const onLayerConfigChange = vi.fn();
    const { getByDisplayValue } = wrap(
      <NarrativeEditor
        {...baseProps}
        datasetType="pointcloud"
        layerConfig={{ ...DEFAULT_LAYER_CONFIG, dataset_id: "pc-1" }}
        mapState={{ ...DEFAULT_MAP_STATE }}
        onMapStateChange={() => {}}
        onLayerConfigChange={onLayerConfigChange}
      />
    );
    fireEvent.change(getByDisplayValue("Elevation"), {
      target: { value: "intensity" },
    });
    expect(onLayerConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ color_mode: "intensity" })
    );
  });

  it("editing COPC point size writes point_size into layer_config", () => {
    const onLayerConfigChange = vi.fn();
    const { getByLabelText } = wrap(
      <NarrativeEditor
        {...baseProps}
        datasetType="pointcloud"
        layerConfig={{ ...DEFAULT_LAYER_CONFIG, dataset_id: "pc-1" }}
        mapState={{ ...DEFAULT_MAP_STATE }}
        onMapStateChange={() => {}}
        onLayerConfigChange={onLayerConfigChange}
      />
    );
    fireEvent.change(getByLabelText("Point size"), {
      target: { value: "5" },
    });
    expect(onLayerConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ point_size: 5 })
    );
  });

  it("shows a trail-length input for a trajectory dataset and writes trail_length", () => {
    const onLayerConfigChange = vi.fn();
    const { getByLabelText } = wrap(
      <NarrativeEditor
        {...baseProps}
        datasetType="trajectory"
        layerConfig={{ ...DEFAULT_LAYER_CONFIG, dataset_id: "traj-1" }}
        mapState={{ ...DEFAULT_MAP_STATE }}
        onMapStateChange={() => {}}
        onLayerConfigChange={onLayerConfigChange}
      />
    );
    fireEvent.change(getByLabelText("Trail length"), {
      target: { value: "300" },
    });
    expect(onLayerConfigChange).toHaveBeenCalledWith(
      expect.objectContaining({ trail_length: 300 })
    );
  });

  it("does not show a trail-length input for a raster dataset", () => {
    const { queryByLabelText } = wrap(
      <NarrativeEditor
        {...baseProps}
        datasetType="raster"
        layerConfig={{ ...DEFAULT_LAYER_CONFIG, dataset_id: "ds-1" }}
        mapState={{ ...DEFAULT_MAP_STATE }}
        onMapStateChange={() => {}}
      />
    );
    expect(queryByLabelText("Trail length")).toBeNull();
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
