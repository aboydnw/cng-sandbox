import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { ReportCard } from "./ReportCard";
import { system } from "../theme";
import type { Dataset } from "../types";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: "test-id",
    filename: "test.shp",
    dataset_type: "vector",
    format_pair: "shapefile-to-geoparquet",
    tile_url: "/pmtiles/datasets/test-id/test.pmtiles",
    bounds: [-180, -90, 180, 90],
    band_count: null,
    band_names: null,
    color_interpretation: null,
    dtype: null,
    original_file_size: 188743680,
    converted_file_size: 14680064,
    geoparquet_file_size: null,
    feature_count: 24891,
    geometry_types: ["Polygon"],
    min_zoom: 0,
    max_zoom: 14,
    stac_collection_id: null,
    pg_table: null,
    parquet_url: null,
    validation_results: [],
    credits: [],
    created_at: "2026-01-01T00:00:00Z",
    is_temporal: false,
    timesteps: [],
    raster_min: null,
    raster_max: null,
    ...overrides,
  };
}

describe("ReportCard", () => {
  it("renders nothing when closed", () => {
    const { container } = renderWithChakra(
      <ReportCard dataset={makeDataset()} isOpen={false} onClose={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders drawer when open", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("Your data, transformed")).toBeTruthy();
    expect(screen.getByText("test.shp")).toBeTruthy();
  });

  it("calls onClose when ✕ is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={onClose} />);
    await user.click(screen.getByLabelText("Close report card"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows file size comparison when both sizes present", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("180.0 MB")).toBeTruthy();
    expect(screen.getAllByText("14.0 MB").length).toBeGreaterThan(0);
    expect(screen.getByText(/92% smaller/)).toBeTruthy();
  });

  it("shows feature count and geometry type for vector datasets", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/24,891/)).toBeTruthy();
    expect(screen.getByText(/Polygon features/)).toBeTruthy();
  });

  it("hides feature section for raster datasets", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({ dataset_type: "raster", format_pair: "geotiff-to-cog", feature_count: null, geometry_types: null })}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.queryByText(/features/)).toBeNull();
  });

  it("shows zoom range when available", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/z0–z14/)).toBeTruthy();
  });

  it("calls onScrollToCredits when footer link is clicked", async () => {
    const user = userEvent.setup();
    const onScrollToCredits = vi.fn();
    renderWithChakra(
      <ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} onScrollToCredits={onScrollToCredits} />
    );
    await user.click(screen.getByText("See the full pipeline →"));
    expect(onScrollToCredits).toHaveBeenCalled();
  });

  it("shows mixed geometry type label with slash join", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({ geometry_types: ["Polygon", "MultiPolygon"] })}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText(/Polygon \/ MultiPolygon features/)).toBeTruthy();
  });

  it("shows transformation steps for shapefile-to-pmtiles path", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/.shp.*Shapefile/)).toBeTruthy();
    expect(screen.getByText(/.parquet.*GeoParquet/)).toBeTruthy();
    expect(screen.getByText(/.pmtiles.*PMTiles/)).toBeTruthy();
  });
});
