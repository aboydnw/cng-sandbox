import { describe, it, expect, vi, beforeEach } from "vitest";
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

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });
});

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

describe("UploadPage", () => {
  it("renders exactly two path cards: Visualize data and Build a story", () => {
    renderPage();
    expect(screen.getByText("Visualize data")).toBeTruthy();
    expect(screen.getByText("Build a story")).toBeTruthy();
  });

  it("does not render the old three cards", () => {
    renderPage();
    expect(screen.queryByText("Convert a file")).toBeNull();
    expect(screen.queryByText("Connect a source")).toBeNull();
  });

  it("does not render SourceCoopGallery", () => {
    renderPage();
    expect(screen.queryByText(/source\.coop/i)).toBeNull();
    expect(screen.queryByText(/example datasets/i)).toBeNull();
  });

  it("expanding Visualize data reveals file uploader and URL input", () => {
    renderPage();
    fireEvent.click(screen.getByText("Visualize data"));
    expect(screen.getByRole("textbox", { name: /url/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /continue/i })).toBeTruthy();
  });

  it("expanding Build a story reveals start from scratch button", () => {
    renderPage();
    fireEvent.click(screen.getByText("Build a story"));
    expect(screen.getByRole("button", { name: /start from scratch/i })).toBeTruthy();
  });
});
