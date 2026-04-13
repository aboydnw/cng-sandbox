import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { ReportCard, getTileUrlPrefix } from "./ReportCard";
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
    cog_url: null,
    validation_results: [],
    credits: [
      {
        tool: "GeoPandas",
        role: "Converted",
        url: "https://github.com/geopandas/geopandas",
      },
      {
        tool: "tippecanoe",
        role: "Tiled",
        url: "https://github.com/felt/tippecanoe",
      },
    ],
    created_at: "2026-01-01T00:00:00Z",
    is_temporal: false,
    timesteps: [],
    raster_min: null,
    raster_max: null,
    is_categorical: false,
    categories: null,
    crs: null,
    crs_name: null,
    pixel_width: null,
    pixel_height: null,
    resolution: null,
    compression: null,
    is_mosaic: false,
    is_zero_copy: false,
    source_url: null,
    expires_at: null,
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
    renderWithChakra(
      <ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />
    );
    expect(screen.getByText("Your data, transformed")).toBeTruthy();
    expect(screen.getByText("test.shp")).toBeTruthy();
  });

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithChakra(
      <ReportCard dataset={makeDataset()} isOpen={true} onClose={onClose} />
    );
    await user.click(screen.getByLabelText("Close report card"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders pipeline timeline with all 4 steps", () => {
    renderWithChakra(
      <ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />
    );
    expect(screen.getByText("Convert")).toBeTruthy();
    expect(screen.getByText("Catalog")).toBeTruthy();
    expect(screen.getByText("Store")).toBeTruthy();
    expect(screen.getByText("Display")).toBeTruthy();
  });

  it("shows convert step content by default for pmtiles vector dataset", () => {
    renderWithChakra(
      <ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />
    );
    expect(
      screen.getByText("Converted to PMTiles vector tile archive")
    ).toBeTruthy();
  });

  it("shows convert step content for geotiff-to-cog datasets", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({
          dataset_type: "raster",
          format_pair: "geotiff-to-cog",
          tile_url: "/raster/datasets/test-id",
          credits: [
            {
              tool: "rio-cogeo",
              role: "Converted",
              url: "https://github.com/cogeotiff/rio-cogeo",
            },
          ],
        })}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(
      screen.getByText("Converted to Cloud Optimized GeoTIFF (COG)")
    ).toBeTruthy();
  });

  it("shows convert step content for postgis vector datasets", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({
          tile_url: "/vector/collections/public.test/tiles",
          credits: [
            {
              tool: "GeoPandas",
              role: "Converted",
              url: "https://github.com/geopandas/geopandas",
            },
          ],
        })}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("Converted to GeoParquet")).toBeTruthy();
  });
});

describe("getTileUrlPrefix", () => {
  it("extracts /pmtiles/ from pmtiles URL", () => {
    expect(getTileUrlPrefix("/pmtiles/datasets/test-id/test.pmtiles")).toBe(
      "/pmtiles/"
    );
  });

  it("extracts /raster/ from raster URL", () => {
    expect(getTileUrlPrefix("/raster/datasets/test-id")).toBe("/raster/");
  });

  it("extracts /vector/ from vector URL", () => {
    expect(getTileUrlPrefix("/vector/collections/public.test/tiles")).toBe(
      "/vector/"
    );
  });
});
