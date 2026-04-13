import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";
import UploadPage from "../UploadPage";

vi.mock("../../lib/api", () => ({
  datasetsApi: { list: vi.fn().mockResolvedValue([]) },
  connectionsApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: "test-conn-1" }),
  },
  setWorkspaceId: vi.fn(),
  workspaceFetch: vi
    .fn()
    .mockResolvedValue({ json: () => Promise.resolve([]) }),
}));

vi.mock("../../lib/connections", () => ({
  detectConnectionType: vi.fn().mockReturnValue(null),
  extractNameFromUrl: vi.fn().mockReturnValue(""),
  probePMTiles: vi.fn().mockResolvedValue({}),
  probeCOG: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../hooks/useConversionJob", () => ({
  useConversionJob: vi.fn().mockReturnValue({
    state: {
      isUploading: false,
      jobId: null,
      status: null,
      stages: [],
      scanResult: null,
      datasetId: null,
      error: null,
      duplicate: null,
      progressCurrent: null,
      progressTotal: null,
    },
    startUpload: vi.fn(),
    startUrlFetch: vi.fn(),
    startTemporalUpload: vi.fn(),
    confirmVariable: vi.fn(),
    resetJob: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <UploadPage />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("UploadPage — three card layout", () => {
  it("renders all three cards in collapsed state", () => {
    renderPage();
    expect(screen.getByText("Convert a file")).toBeTruthy();
    expect(screen.getByText("Connect a source")).toBeTruthy();
    expect(screen.getByText("Build a story")).toBeTruthy();
  });

  it("renders card descriptions in collapsed state", () => {
    renderPage();
    expect(
      screen.getByText(
        "Upload a geospatial file and we'll convert it to a shareable web map"
      )
    ).toBeTruthy();
    expect(
      screen.getByText("Point to data already hosted in the cloud")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Create a storytelling narrative with your data or from our public library"
      )
    ).toBeTruthy();
  });

  it("expands connect card on click and shows form", () => {
    renderPage();
    fireEvent.click(screen.getByText("Connect a source"));
    expect(screen.getByText("Add Connection")).toBeTruthy();
    // Other cards should lose their descriptions (faded state)
    expect(
      screen.queryByText(
        "Upload a geospatial file and we'll convert it to a shareable web map"
      )
    ).toBeNull();
  });

  it("expands upload card on click and hides connect description", () => {
    renderPage();
    fireEvent.click(screen.getByText("Convert a file"));
    expect(
      screen.queryByText("Point to data already hosted in the cloud")
    ).toBeNull();
  });
});

describe("UploadPage — duplicate warning", () => {
  it("shows duplicate warning when state has duplicate info", async () => {
    const { useConversionJob } = await import("../../hooks/useConversionJob");
    vi.mocked(useConversionJob).mockReturnValue({
      state: {
        isUploading: false,
        jobId: null,
        status: "pending",
        stages: [],
        scanResult: null,
        datasetId: null,
        error: null,
        progressCurrent: null,
        progressTotal: null,
        duplicate: { datasetId: "abc-123", filename: "elevation.tif" },
      },
      startUpload: vi.fn(),
      startUrlFetch: vi.fn(),
      startTemporalUpload: vi.fn(),
      confirmVariable: vi.fn(),
      resetJob: vi.fn(),
    });

    renderPage();

    expect(screen.getByText(/already exists in your library/)).toBeTruthy();
    expect(screen.getByText("Go to Library")).toBeTruthy();
    expect(screen.getByText("Upload another file")).toBeTruthy();
  });
});
