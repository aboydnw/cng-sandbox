import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { SourceCoopGallery } from "../SourceCoopGallery";

const navigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom"
    );
  return { ...actual, useNavigate: () => navigate };
});

vi.mock("../../hooks/useWorkspace", () => ({
  useWorkspace: () => ({ workspacePath: (p: string) => `/w/test${p}` }),
}));

function wrap(ui: React.ReactElement) {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ChakraProvider>
  );
}

describe("SourceCoopGallery", () => {
  beforeEach(() => {
    navigate.mockReset();
  });

  it("navigates to the matching example dataset when a card is clicked", async () => {
    const datasets = [
      {
        id: "example-gebco-id",
        filename: "GEBCO 2024 Bathymetry",
        source_url: "https://data.source.coop/alexgleith/gebco-2024/",
        is_example: true,
      },
    ];

    wrap(<SourceCoopGallery datasets={datasets as never} />);

    await userEvent.click(screen.getByRole("button", { name: /GEBCO 2024/i }));

    expect(navigate).toHaveBeenCalledWith("/w/test/map/example-gebco-id");
  });

  it("disables a card whose example dataset has not registered yet", () => {
    wrap(<SourceCoopGallery datasets={[] as never} />);

    const btn = screen.getByRole("button", { name: /GEBCO 2024/i });
    expect(btn).toBeDisabled();
  });
});
