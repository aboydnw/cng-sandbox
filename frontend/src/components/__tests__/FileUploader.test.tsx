import { describe, it, expect, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { FileUploader } from "../FileUploader";

function renderUploader() {
  const onFileSelected = vi.fn();
  const { container } = render(
    <ChakraProvider value={system}>
      <FileUploader
        onFileSelected={onFileSelected}
        onFilesSelected={vi.fn()}
        onUrlSubmitted={vi.fn()}
      />
    </ChakraProvider>
  );
  const input = container.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  return { onFileSelected, input };
}

describe("FileUploader accepted formats", () => {
  it("accepts a .gpx trajectory file", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["<gpx/>"], "track.gpx", { type: "application/gpx+xml" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("accepts a .laz point-cloud file", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["x"], "scan.laz", { type: "application/octet-stream" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });

  it("rejects an unsupported extension", () => {
    const { onFileSelected, input } = renderUploader();
    const file = new File(["x"], "notes.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFileSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/unsupported format/i)).toBeInTheDocument();
  });
});
