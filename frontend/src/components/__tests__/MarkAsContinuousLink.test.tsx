import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { MarkAsContinuousLink } from "../MarkAsContinuousLink";

const fetchMock = vi.fn();
vi.mock("../../lib/api", () => ({
  workspaceFetch: (...args: unknown[]) => fetchMock(...args),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("MarkAsContinuousLink", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts to unmark-categorical and calls onSuccess", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ is_categorical: false }),
    });
    const onSuccess = vi.fn();
    renderWithProvider(
      <MarkAsContinuousLink datasetId="ds-1" onSuccess={onSuccess} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /mark as continuous/i })
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/datasets/ds-1/unmark-categorical",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("surfaces an error when the request fails", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    renderWithProvider(
      <MarkAsContinuousLink datasetId="ds-1" onSuccess={vi.fn()} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /mark as continuous/i })
    );

    expect(
      await screen.findByText(/could not mark as continuous/i)
    ).toBeInTheDocument();
  });

  it("prevents duplicate POSTs on rapid re-click", async () => {
    let resolveFetch: ((value: { ok: boolean }) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    const onSuccess = vi.fn();
    renderWithProvider(
      <MarkAsContinuousLink datasetId="ds-1" onSuccess={onSuccess} />
    );

    const button = screen.getByRole("button", { name: /mark as continuous/i });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch?.({ ok: true });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });
});
