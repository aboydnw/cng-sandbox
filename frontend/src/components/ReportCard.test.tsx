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
      { tool: "GeoPandas", role: "Converted", url: "https://github.com/geopandas/geopandas" },
      { tool: "tippecanoe", role: "Tiled", url: "https://github.com/felt/tippecanoe" },
    ],
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

  it("calls onClose when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={onClose} />);
    await user.click(screen.getByLabelText("Close report card"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows transformation steps for shapefile-to-pmtiles path", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText(/.shp.*Shapefile/)).toBeTruthy();
    expect(screen.getByText(/.parquet.*GeoParquet/)).toBeTruthy();
    expect(screen.getByText(/.pmtiles.*PMTiles/)).toBeTruthy();
  });

  it("renders TechCards based on dataset credits", () => {
    renderWithChakra(<ReportCard dataset={makeDataset()} isOpen={true} onClose={() => {}} />);
    expect(screen.getByText("GeoPandas")).toBeTruthy();
    expect(screen.getByText("tippecanoe")).toBeTruthy();
    expect(screen.getByText("PMTiles + MapLibre")).toBeTruthy();
  });

  it("renders raster tech cards for geotiff-to-cog datasets", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({
          dataset_type: "raster",
          format_pair: "geotiff-to-cog",
          tile_url: "/raster/datasets/test-id",
          credits: [
            { tool: "rio-cogeo", role: "Converted", url: "https://github.com/cogeotiff/rio-cogeo" },
          ],
        })}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("rio-cogeo")).toBeTruthy();
    expect(screen.getByText("MinIO (S3-compatible)")).toBeTruthy();
    expect(screen.getByText("titiler + deck.gl")).toBeTruthy();
  });

  it("shows deck.gl client-side card when renderMode is client", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({
          dataset_type: "raster",
          format_pair: "geotiff-to-cog",
          tile_url: "/raster/datasets/test-id",
          credits: [
            { tool: "rio-cogeo", role: "Converted", url: "https://github.com/cogeotiff/rio-cogeo" },
          ],
        })}
        isOpen={true}
        onClose={() => {}}
        renderMode="client"
      />
    );
    expect(screen.getByText("deck.gl (client-side)")).toBeTruthy();
    expect(screen.queryByText("titiler + deck.gl")).toBeNull();
  });

  it("renders vector/tipg tech cards for non-pmtiles vector datasets", () => {
    renderWithChakra(
      <ReportCard
        dataset={makeDataset({
          tile_url: "/vector/collections/public.test/tiles",
          credits: [
            { tool: "GeoPandas", role: "Converted", url: "https://github.com/geopandas/geopandas" },
          ],
        })}
        isOpen={true}
        onClose={() => {}}
      />
    );
    expect(screen.getByText("GeoPandas")).toBeTruthy();
    expect(screen.getByText("PostGIS")).toBeTruthy();
    expect(screen.getByText("tipg + MapLibre")).toBeTruthy();
  });
});

describe("getTileUrlPrefix", () => {
  it("extracts /pmtiles/ from pmtiles URL", () => {
    expect(getTileUrlPrefix("/pmtiles/datasets/test-id/test.pmtiles")).toBe("/pmtiles/");
  });

  it("extracts /raster/ from raster URL", () => {
    expect(getTileUrlPrefix("/raster/datasets/test-id")).toBe("/raster/");
  });

  it("extracts /vector/ from vector URL", () => {
    expect(getTileUrlPrefix("/vector/collections/public.test/tiles")).toBe("/vector/");
  });
});
