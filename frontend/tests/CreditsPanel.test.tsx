import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import { CreditsPanel } from "../src/components/CreditsPanel";
import type { Dataset } from "../src/types";

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <ChakraProvider value={system}>{ui}</ChakraProvider>
    </MemoryRouter>,
  );
}

const rasterDataset: Dataset = {
  id: "d1",
  filename: "rainfall.tif",
  dataset_type: "raster",
  format_pair: "geotiff-to-cog",
  tile_url: "http://localhost:8082/tiles",
  bounds: [-180, -90, 180, 90],
  band_count: 1,
  band_names: ["Precipitation"],
  color_interpretation: ["gray"],
  dtype: "float32",
  original_file_size: 5242880,
  converted_file_size: 2621440,
  feature_count: null,
  geometry_types: null,
  min_zoom: 0,
  max_zoom: 12,
  stac_collection_id: "sandbox-d1",
  pg_table: null,
  parquet_url: null,
  validation_results: [
    { name: "COG structure", passed: true, detail: "Valid COG" },
    { name: "CRS present", passed: true, detail: "EPSG:4326" },
  ],
  credits: [
    { tool: "rio-cogeo", url: "https://github.com/cogeotiff/rio-cogeo", role: "Converted by" },
    { tool: "TiTiler", url: "https://developmentseed.org/titiler", role: "Tiles served by" },
  ],
  created_at: new Date().toISOString(),
  geoparquet_file_size: null,
  is_temporal: false,
  timesteps: [],
  raster_min: null,
  raster_max: null,
};

const rgbDataset: Dataset = {
  ...rasterDataset,
  band_count: 3,
  band_names: ["Red", "Green", "Blue"],
  color_interpretation: ["red", "green", "blue"],
  dtype: "uint8",
};

describe("CreditsPanel", () => {
  it("renders tool credits", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/rio-cogeo/)).toBeTruthy();
    expect(screen.getByText(/TiTiler/)).toBeTruthy();
  });

  it("shows validation summary", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/2\/2 checks passed/)).toBeTruthy();
  });

  it("renders what's next links", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/turn this into a story/i)).toBeTruthy();
    expect(screen.getByText(/talk to development seed/i)).toBeTruthy();
  });

  it("shows raster metadata for single-band dataset", () => {
    renderWithProviders(<CreditsPanel dataset={rasterDataset} />);
    expect(screen.getByText(/single-band/i)).toBeTruthy();
    expect(screen.getByText(/float32/i)).toBeTruthy();
  });

  it("shows RGB label for 3-band RGB dataset", () => {
    renderWithProviders(<CreditsPanel dataset={rgbDataset} />);
    expect(screen.getByText(/3-band rgb/i)).toBeTruthy();
  });

  it("does not show raster section for vector dataset", () => {
    const vectorDataset: Dataset = {
      ...rasterDataset,
      dataset_type: "vector",
      band_count: null,
      band_names: null,
      color_interpretation: null,
      dtype: null,
    };
    renderWithProviders(<CreditsPanel dataset={vectorDataset} />);
    expect(screen.queryByText(/band/i)).toBeNull();
  });
});
