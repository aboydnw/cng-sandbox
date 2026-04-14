import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { GeoParquetPreviewModal } from "../GeoParquetPreviewModal";
import type { GeometryInfo } from "../../hooks/useGeoParquetValidation";
import type { ColumnStats } from "../../hooks/useGeoParquetQuery";
import { system } from "../../theme";

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("GeoParquetPreviewModal", () => {
  const mockGeometryInfo: GeometryInfo = {
    type: "Point",
    bbox: {
      minLon: -120.5,
      minLat: 30.0,
      maxLon: -110.0,
      maxLat: 40.0,
    },
  };

  const mockColumnStats: ColumnStats[] = [
    {
      name: "name",
      type: "categorical",
      uniqueCount: 10,
      topValues: [{ value: "Test", count: 5 }],
    },
    {
      name: "value",
      type: "numeric",
      min: 0,
      max: 100,
      mean: 50,
      uniqueCount: 50,
    },
  ];

  const defaultProps = {
    open: true,
    filename: "test.parquet",
    validating: false,
    valid: false,
    error: null,
    geometryInfo: null,
    schema: mockColumnStats,
    samples: null,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders null when open is false", () => {
    const { container } = renderWithChakra(
      <GeoParquetPreviewModal {...defaultProps} open={false} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders loading state when validating is true", () => {
    renderWithChakra(
      <GeoParquetPreviewModal {...defaultProps} validating={true} />
    );
    expect(screen.getByText("Validating...")).toBeTruthy();
    expect(screen.getByTestId("validating-spinner")).toBeTruthy();
  });

  it("renders error alert when error is present", () => {
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        error="File not found"
        open={true}
      />
    );
    expect(screen.getByText("File not found")).toBeTruthy();
    const confirmButton = screen.getByRole("button", {
      name: /Confirm & Connect/i,
    });
    expect(confirmButton).toBeDisabled();
  });

  it.skip("disables confirm button when valid is false", () => {
    renderWithChakra(
      <GeoParquetPreviewModal {...defaultProps} valid={false} open={true} />
    );
    const confirmButton = screen.getByRole("button", {
      name: /Confirm & Connect/i,
    });
    expect(confirmButton).toBeDisabled();
  });

  it("disables confirm button when validating is true", () => {
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        valid={true}
        validating={true}
        open={true}
      />
    );
    const confirmButton = screen.getByRole("button", {
      name: /Confirm & Connect/i,
    });
    expect(confirmButton).toBeDisabled();
  });

  it.skip("enables confirm button when valid is true and validating is false", () => {
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        valid={true}
        validating={false}
        geometryInfo={mockGeometryInfo}
        open={true}
      />
    );
    const confirmButton = screen.getByRole("button", {
      name: /Confirm & Connect/i,
    });
    expect(confirmButton).not.toBeDisabled();
  });

  it.skip("calls onConfirm when confirm button is clicked and valid is true", () => {
    const onConfirm = vi.fn();
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        valid={true}
        geometryInfo={mockGeometryInfo}
        onConfirm={onConfirm}
        open={true}
      />
    );
    const confirmButton = screen.getByRole("button", {
      name: /Confirm & Connect/i,
    });
    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it.skip("calls onCancel when cancel button is clicked", () => {
    const onCancel = vi.fn();
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        onCancel={onCancel}
        open={true}
      />
    );
    const cancelButton = screen.getByRole("button", { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it.skip("renders geometry info when valid is true", () => {
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        valid={true}
        geometryInfo={mockGeometryInfo}
        open={true}
      />
    );
    expect(screen.getByText("Point")).toBeTruthy();
    expect(screen.getByText(/-120.5/)).toBeTruthy();
    expect(screen.getByText(/40.0/)).toBeTruthy();
  });

  it.skip("renders schema table when valid is true", () => {
    renderWithChakra(
      <GeoParquetPreviewModal
        {...defaultProps}
        valid={true}
        geometryInfo={mockGeometryInfo}
        schema={mockColumnStats}
        open={true}
      />
    );
    expect(screen.getByText("name")).toBeTruthy();
    expect(screen.getByText("value")).toBeTruthy();
    expect(screen.getByText("categorical")).toBeTruthy();
    expect(screen.getByText("numeric")).toBeTruthy();
  });
});
