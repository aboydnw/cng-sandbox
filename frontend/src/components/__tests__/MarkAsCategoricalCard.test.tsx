import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { MarkAsCategoricalCard } from "../MarkAsCategoricalCard";

const fetchMock = vi.fn();
vi.mock("../../lib/api", () => ({
  workspaceFetch: (...args: unknown[]) => fetchMock(...args),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("MarkAsCategoricalCard", () => {
  beforeEach(() => fetchMock.mockReset());

  it("posts to the endpoint and calls onSuccess", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ is_categorical: true }),
    });
    const onSuccess = vi.fn();
    renderWithProvider(
      <MarkAsCategoricalCard datasetId="ds-1" onSuccess={onSuccess} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /mark as categorical/i })
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/datasets/ds-1/mark-categorical",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("shows too-many-values error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ detail: { error: "too_many_values", count: 57 } }),
    });
    renderWithProvider(
      <MarkAsCategoricalCard datasetId="ds-1" onSuccess={vi.fn()} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /mark as categorical/i })
    );
    expect(await screen.findByText(/57 unique values/)).toBeInTheDocument();
  });

  it("shows unsupported-dtype error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        detail: { error: "unsupported_dtype", dtype: "float32" },
      }),
    });
    renderWithProvider(
      <MarkAsCategoricalCard datasetId="ds-1" onSuccess={vi.fn()} />
    );

    fireEvent.click(
      screen.getByRole("button", { name: /mark as categorical/i })
    );
    expect(await screen.findByText(/float32/)).toBeInTheDocument();
  });
});
