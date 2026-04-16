import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { EditableDatasetTitle } from "../EditableDatasetTitle";

const fetchMock = vi.fn();
vi.mock("../../lib/api", () => ({
  workspaceFetch: (...args: unknown[]) => fetchMock(...args),
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("EditableDatasetTitle", () => {
  beforeEach(() => fetchMock.mockReset());

  it("renders filename when title is null", () => {
    renderWithProvider(
      <EditableDatasetTitle datasetId="ds-1" title={null} filename="raw.tif" onSaved={vi.fn()} editable />,
    );
    expect(screen.getByText("raw.tif")).toBeInTheDocument();
  });

  it("renders title when set", () => {
    renderWithProvider(
      <EditableDatasetTitle datasetId="ds-1" title="Pedotopes" filename="raw.tif" onSaved={vi.fn()} editable />,
    );
    expect(screen.getByText("Pedotopes")).toBeInTheDocument();
  });

  it("saves on blur", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const onSaved = vi.fn();
    renderWithProvider(
      <EditableDatasetTitle datasetId="ds-1" title={null} filename="raw.tif" onSaved={onSaved} editable />,
    );

    fireEvent.click(screen.getByText("raw.tif"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "New name" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/datasets/ds-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ title: "New name" }),
      }),
    );
  });

  it("cancels on Escape", () => {
    const onSaved = vi.fn();
    renderWithProvider(
      <EditableDatasetTitle datasetId="ds-1" title="Pedotopes" filename="raw.tif" onSaved={onSaved} editable />,
    );

    fireEvent.click(screen.getByText("Pedotopes"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Trash" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Pedotopes")).toBeInTheDocument();
  });

  it("does not enter edit mode when editable=false", () => {
    renderWithProvider(
      <EditableDatasetTitle datasetId="ds-1" title="X" filename="y.tif" onSaved={vi.fn()} editable={false} />,
    );
    fireEvent.click(screen.getByText("X"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});
