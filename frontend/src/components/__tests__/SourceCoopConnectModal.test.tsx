import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ChakraProvider } from "@chakra-ui/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { system } from "../../theme";
import { SourceCoopConnectModal } from "../SourceCoopConnectModal";
import { WorkspaceProvider } from "../../hooks/useWorkspace";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockConnect = vi.fn();
vi.mock("../../lib/sourceCoopApi", () => ({
  connectSourceCoop: (...args: unknown[]) => mockConnect(...args),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/abc"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={<WorkspaceProvider>{ui}</WorkspaceProvider>}
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>,
  );
}

describe("SourceCoopConnectModal", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockConnect.mockReset();
  });

  it("does not render when slug is null", () => {
    renderWithProviders(
      <SourceCoopConnectModal
        slug={null}
        onClose={vi.fn()}
        workspaceId="abc"
      />,
    );
    expect(screen.queryByText(/Connect this dataset/i)).toBeNull();
  });

  it("shows product name when slug is set", () => {
    renderWithProviders(
      <SourceCoopConnectModal
        slug="alexgleith/gebco-2024"
        onClose={vi.fn()}
        workspaceId="abc"
      />,
    );
    expect(screen.getByText(/GEBCO/i)).toBeTruthy();
  });

  it("calls connectSourceCoop and navigates on confirm", async () => {
    mockConnect.mockResolvedValueOnce({
      dataset_id: "ds-1",
      job_id: "job-1",
    });

    renderWithProviders(
      <SourceCoopConnectModal
        slug="alexgleith/gebco-2024"
        onClose={vi.fn()}
        workspaceId="abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Connect$/i }));

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalledWith("alexgleith/gebco-2024", "abc");
      expect(mockNavigate).toHaveBeenCalled();
      expect(mockNavigate.mock.calls[0][0]).toContain("ds-1");
    });
  });

  it("shows an error message if the API call fails", async () => {
    mockConnect.mockRejectedValueOnce(new Error("source.coop unreachable"));

    renderWithProviders(
      <SourceCoopConnectModal
        slug="alexgleith/gebco-2024"
        onClose={vi.fn()}
        workspaceId="abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^Connect$/i }));

    await waitFor(() => {
      expect(screen.getByText(/unreachable/i)).toBeTruthy();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
