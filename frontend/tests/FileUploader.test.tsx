import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../src/theme";
import { FileUploader } from "../src/components/FileUploader";

function renderWithProviders(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("FileUploader", () => {
  it("renders drop zone and URL input", () => {
    renderWithProviders(
      <FileUploader onFileSelected={vi.fn()} onFilesSelected={vi.fn()} onUrlSubmitted={vi.fn()} />,
    );
    expect(screen.getByText(/drop your file here/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/paste/i)).toBeTruthy();
  });

  it("rejects unsupported file extensions", () => {
    const onFile = vi.fn();
    renderWithProviders(
      <FileUploader onFileSelected={onFile} onFilesSelected={vi.fn()} onUrlSubmitted={vi.fn()} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "doc.xlsx", { type: "application/vnd.ms-excel" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).not.toHaveBeenCalled();
    expect(screen.getByText(/unsupported/i)).toBeTruthy();
  });

  it("accepts valid file extensions", () => {
    const onFile = vi.fn();
    renderWithProviders(
      <FileUploader onFileSelected={onFile} onFilesSelected={vi.fn()} onUrlSubmitted={vi.fn()} />,
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["data"], "raster.tif", { type: "image/tiff" });
    fireEvent.change(input, { target: { files: [file] } });

    expect(onFile).toHaveBeenCalledWith(file);
  });
});
