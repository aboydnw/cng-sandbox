import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { MapSidePanel } from "../MapSidePanel";
import type { MapItem } from "../../types";

vi.mock("../DataSwitcher", () => ({
  DataSwitcher: () => <div data-testid="data-switcher" />,
}));

vi.mock("../RasterSidebarControls", () => ({
  RasterSidebarControls: () => <div data-testid="raster-controls" />,
}));

vi.mock("../VectorSidebarControls", () => ({
  VectorSidebarControls: () => <div data-testid="vector-controls" />,
}));

vi.mock("../ConversionSummaryCard", () => ({
  ConversionSummaryCard: () => <div data-testid="conversion-summary" />,
}));

vi.mock("../ConnectionInfoCard", () => ({
  ConnectionInfoCard: () => <div data-testid="connection-info" />,
}));

const mockItem: MapItem = {
  id: "test-id",
  name: "test.tif",
  source: "dataset",
  dataType: "raster",
  tileUrl: "/raster/tiles",
  bounds: null,
  copcUrl: null,
  tripsUrl: null,
  pointCount: null,
  minZoom: null,
  maxZoom: null,
  bandCount: 1,
  bandNames: null,
  colorInterpretation: null,
  dtype: null,
  rasterMin: null,
  rasterMax: null,
  cogUrl: null,
  crs: null,
  rescale: null,
  parquetUrl: null,
  isTemporal: false,
  isCategorical: false,
  categories: null,
  timesteps: [],
  renderMode: null,
  preferredColormap: null,
  preferredColormapReversed: null,
  geozarrAttrs: null,
  zarrExtraDim: null,
  zarrExtraIndex: null,
  dataset: null,
  connection: null,
};

const defaultProps = {
  item: mockItem,
  opacity: 1,
  onOpacityChange: vi.fn(),
  colormapName: "viridis",
  onColormapChange: vi.fn(),
  selectedBand: "rgb" as const,
  onBandChange: vi.fn(),
  renderMode: "server" as const,
  onRenderModeChange: vi.fn(),
  showingColormap: false,
  selectableBands: [],
  hasRgb: true,
  showBands: false,
  canClientRender: false,
  clientRenderDisabledReason: null,
  bytesTransferred: null,
  onDetailsClick: vi.fn(),
  onTableChange: vi.fn(),
  isCategorical: false,
  categories: null,
  onCategoriesChange: vi.fn(),
  onCategoricalOverride: vi.fn(),
  showCategoricalToggle: false,
  rescaleMin: null,
  rescaleMax: null,
  onRescaleChange: vi.fn(),
  colormapReversed: false,
  onColormapReversedChange: vi.fn(),
  datasetMin: null,
  datasetMax: null,
  canMarkCategorical: false,
  canMarkContinuous: false,
  onDatasetUpdated: vi.fn(),
};

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={defaultSystem}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ChakraProvider>
  );
}

test("normal mode links safely to Earth Stories", () => {
  renderWithProviders(<MapSidePanel {...defaultProps} />);
  const link = screen.getByRole("link", {
    name: /explore earth stories on github/i,
  });
  expect(link).toHaveAttribute(
    "href",
    "https://github.com/aboydnw/earth-stories"
  );
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.queryByText(/save as story chapter/i)).not.toBeInTheDocument();
});

test("shared mode hides the Earth Stories CTA", () => {
  renderWithProviders(<MapSidePanel {...defaultProps} shared />);
  expect(
    screen.queryByRole("link", { name: /explore earth stories on github/i })
  ).not.toBeInTheDocument();
});

test("normal mode shows DataSwitcher", () => {
  renderWithProviders(<MapSidePanel {...defaultProps} />);
  expect(screen.getByTestId("data-switcher")).toBeInTheDocument();
});

test("shared mode hides DataSwitcher", () => {
  renderWithProviders(<MapSidePanel {...defaultProps} shared />);
  expect(screen.queryByTestId("data-switcher")).not.toBeInTheDocument();
});
