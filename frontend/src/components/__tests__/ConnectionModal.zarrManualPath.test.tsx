import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ConnectionModal } from "../ConnectionModal";
import { ZARR_NOT_CONSOLIDATED } from "../../lib/zarr/probeZarr";

vi.mock("../../lib/zarr/probeZarr", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/zarr/probeZarr")
  >("../../lib/zarr/probeZarr");
  return {
    ...actual,
    probeZarr: vi.fn(),
    probeZarrSingleArray: vi.fn(),
  };
});

import { probeZarr, probeZarrSingleArray } from "../../lib/zarr/probeZarr";

function renderModal() {
  return render(
    <ChakraProvider value={system}>
      <ConnectionModal isOpen={true} onClose={() => {}} onCreated={() => {}} />
    </ChakraProvider>
  );
}

describe("ConnectionModal — non-consolidated zarr fallback", () => {
  beforeEach(() => {
    vi.mocked(probeZarr).mockReset();
    vi.mocked(probeZarrSingleArray).mockReset();
  });

  it("offers a manual variable path input when consolidated metadata is missing", async () => {
    vi.mocked(probeZarr).mockRejectedValue(new Error(ZARR_NOT_CONSOLIDATED));
    renderModal();

    const urlInput = screen.getByPlaceholderText(/https:\/\/bucket/i);
    fireEvent.change(urlInput, {
      target: { value: "https://example.com/store.zarr" },
    });
    fireEvent.blur(urlInput);

    await waitFor(() =>
      expect(
        screen.getByText(/manual variable path/i, { exact: false })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole("button", { name: /try this path/i })
    ).toBeInTheDocument();
  });

  it("re-probes with probeZarrSingleArray when the user submits a path", async () => {
    vi.mocked(probeZarr).mockRejectedValue(new Error(ZARR_NOT_CONSOLIDATED));
    vi.mocked(probeZarrSingleArray).mockResolvedValue({
      variables: [
        {
          name: "precipitation",
          shape: [10, 360, 720],
          dimNames: ["time", "latitude", "longitude"],
          dtype: "float32",
          attrs: { valid_min: 0, valid_max: 100 },
          stats: { min: 0, max: 100 },
          timeDim: "time",
          timesteps: null,
          extraDim: null,
          extraLabels: null,
          compatibility: { kind: "ok" },
        },
      ],
      crsWarning: null,
      rootAttrs: null,
    });

    renderModal();
    const urlInput = screen.getByPlaceholderText(/https:\/\/bucket/i);
    fireEvent.change(urlInput, {
      target: { value: "https://example.com/store.zarr" },
    });
    fireEvent.blur(urlInput);
    await waitFor(() => screen.getByRole("button", { name: /try this path/i }));

    const pathInput = screen.getByPlaceholderText(/variable path/i);
    fireEvent.change(pathInput, { target: { value: "precipitation" } });
    fireEvent.click(screen.getByRole("button", { name: /try this path/i }));

    await waitFor(() =>
      expect(probeZarrSingleArray).toHaveBeenCalledWith(
        "https://example.com/store.zarr",
        "precipitation"
      )
    );
  });
});
