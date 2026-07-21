import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { FileUploader } from "../FileUploader";

function renderUploader() {
  const onFileSelected = vi.fn();
  const onFilesSelected = vi.fn();
  const { container } = render(
    <ChakraProvider value={system}>
      <FileUploader
        onFileSelected={onFileSelected}
        onFilesSelected={onFilesSelected}
        onUrlSubmitted={vi.fn()}
      />
    </ChakraProvider>
  );
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  return { onFileSelected, onFilesSelected, input };
}

describe("FileUploader accepted formats", () => {
  const confirmSelection = () =>
    fireEvent.click(screen.getByRole("button", { name: /create map/i }));

  it("accepts a .gpx trajectory file after confirmation", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["<gpx/>"], "track.gpx", {
      type: "application/gpx+xml",
    });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByTitle("track.gpx")).toBeInTheDocument();
    confirmSelection();
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("accepts a .laz point-cloud file", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["x"], "scan.laz", {
      type: "application/octet-stream",
    });
    fireEvent.change(input, { target: { files: [file] } });
    confirmSelection();
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("accepts a .csv file", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["lat,lon\n1,2\n"], "points.csv", {
      type: "text/csv",
    });
    fireEvent.change(input, { target: { files: [file] } });
    confirmSelection();
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("accepts a .tsv file", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["wkt\nPOINT (2 1)\n"], "shapes.tsv", {
      type: "text/tab-separated-values",
    });
    fireEvent.change(input, { target: { files: [file] } });
    confirmSelection();
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("rejects an unsupported extension", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
  });

  it("confirms multiple raster files selected from the file picker", () => {
    const { onFileSelected, onFilesSelected, input } = renderUploader();
    const files = [
      new File(["a"], "first.tif", { type: "image/tiff" }),
      new File(["b"], "second.tiff", { type: "image/tiff" }),
    ];

    fireEvent.change(input, { target: { files } });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText("2 raster files")).toBeInTheDocument();
    confirmSelection();
    expect(onFilesSelected).toHaveBeenCalledWith(files);
  });

  it("confirms multiple raster files dropped together", async () => {
    const { onFileSelected, onFilesSelected } = renderUploader();
    const files = [
      new File(["a"], "first.tif", { type: "image/tiff" }),
      new File(["b"], "second.nc", { type: "application/x-netcdf" }),
    ];
    const items = files.map((file) => ({
      webkitGetAsEntry: () => ({
        isFile: true,
        isDirectory: false,
        file: (callback: (value: File) => void) => callback(file),
      }),
    }));

    fireEvent.drop(screen.getByLabelText("File drop zone"), {
      dataTransfer: { items, files },
    });

    expect(onFileSelected).not.toHaveBeenCalled();
    expect(onFilesSelected).not.toHaveBeenCalled();
    await screen.findByText("2 raster files");
    confirmSelection();
    expect(onFilesSelected).toHaveBeenCalledWith(files);
  });

  it("lists every supported format group", () => {
    renderUploader();
    expect(screen.getByText(/GeoTIFF.*NetCDF.*HDF5/i)).toBeInTheDocument();
    expect(
      screen.getByText(/GeoJSON.*Shapefile ZIP.*CSV/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/LAS.*LAZ.*GPX/i)).toBeInTheDocument();
  });
});
