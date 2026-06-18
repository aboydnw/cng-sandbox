import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { WorkspaceProvider } from "../../hooks/useWorkspace";
import DataPage from "../DataPage";
import type { Connection } from "../../types";

const exampleConnection: Connection = {
  id: "ex-1",
  name: "Example Zarr",
  url: "https://example.org/data.zarr",
  connection_type: "zarr",
  bounds: null,
  min_zoom: null,
  max_zoom: null,
  tile_type: "raster",
  band_count: 1,
  rescale: null,
  workspace_id: null,
  is_categorical: false,
  categories: null,
  tile_url: null,
  render_path: "server",
  conversion_status: "ready",
  conversion_error: null,
  feature_count: null,
  file_size: null,
  is_shared: false,
  is_example: true,
  preferred_colormap: null,
  preferred_colormap_reversed: null,
  config: { variable: "tas", rescaleMin: 0, rescaleMax: 1 },
  geozarr_attrs: null,
  created_at: "2026-04-01T00:00:00Z",
};

const userConnection: Connection = {
  ...exampleConnection,
  id: "ws-1",
  name: "User Zarr",
  is_example: false,
};

vi.mock("../../lib/api", () => ({
  workspaceFetch: vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve([]),
    })
  ),
  connectionsApi: {
    list: vi.fn(() => Promise.resolve([exampleConnection, userConnection])),
    delete: vi.fn(() => Promise.resolve()),
  },
  setWorkspaceId: vi.fn(),
}));

import { workspaceFetch, connectionsApi } from "../../lib/api";

function renderDataPage() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/test-workspace/data"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={
              <WorkspaceProvider>
                <DataPage />
              </WorkspaceProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

describe("DataPage example connection gating", () => {
  it("lists example connections under example data without a delete button", async () => {
    renderDataPage();

    await waitFor(() => {
      expect(screen.getByText("Example Zarr")).toBeInTheDocument();
    });

    expect(screen.getByText("Example data")).toBeInTheDocument();

    const exampleRow = screen.getByText("Example Zarr").closest("tr");
    expect(exampleRow).not.toBeNull();
    expect(exampleRow!.querySelector("button")?.textContent ?? "").not.toMatch(
      /delete/i
    );
  });

  it("shows the delete button on user-owned connections", async () => {
    renderDataPage();

    await waitFor(() => {
      expect(screen.getByText("User Zarr")).toBeInTheDocument();
    });

    const userRow = screen.getByText("User Zarr").closest("tr");
    expect(userRow).not.toBeNull();
    const deleteButton = userRow!.querySelector("button");
    expect(deleteButton?.textContent).toMatch(/delete/i);
  });
});

describe("DataPage fetch failures", () => {
  it("shows an error message when the datasets fetch returns non-ok", async () => {
    (workspaceFetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: "boom" }),
    });
    renderDataPage();

    expect(
      await screen.findByText(/couldn’t load your data library/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/nothing in your data library yet/i)
    ).not.toBeInTheDocument();
  });

  it("shows an error message when the connections fetch rejects", async () => {
    (connectionsApi.list as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("HTTP 502")
    );
    renderDataPage();

    expect(
      await screen.findByText(/couldn’t load your data library/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/nothing in your data library yet/i)
    ).not.toBeInTheDocument();
  });
});
