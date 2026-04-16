import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";

const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<{ ok: boolean; json: () => Promise<{ id: string }> }>>(async () => ({
  ok: true,
  json: async () => ({ id: "c1" }),
}));

vi.mock("../../lib/api", () => ({
  workspaceFetch: (input: RequestInfo | URL, init?: RequestInit) =>
    fetchMock(input, init),
}));

vi.mock("../../hooks/useRemoteConnect", () => ({
  useRemoteConnect: () => ({
    state: {
      phase: "idle",
      datasetId: null,
      error: null,
      discoverResult: null,
    },
    discover: vi.fn(),
    startIngestion: vi.fn(),
  }),
}));

vi.mock("../../hooks/useDuckDB", () => ({
  useDuckDB: () => ({
    conn: {},
    initialize: vi.fn(async () => ({ conn: {} })),
  }),
}));

vi.mock("../../hooks/useGeoParquetQuery", () => ({
  useGeoParquetQuery: () => ({
    result: {
      columnStats: [],
      table: null,
      totalCount: 1000,
      filteredCount: 1000,
      truncated: false,
      error: null,
    },
  }),
}));

let mockRenderPath: "client" | "server" = "client";
let mockSizeBytes: number | null = 5 * 1024 * 1024;

vi.mock("../../hooks/useGeoParquetValidation", () => ({
  useGeoParquetValidation: () => ({
    validating: false,
    valid: true,
    error: null,
    geometryInfo: { type: "Point", bbox: null },
    sizeBytes: mockSizeBytes,
    sizeSource: "head" as const,
    renderPath: mockRenderPath,
    validate: vi.fn(),
  }),
}));

function renderWithChakra(ui: React.ReactElement) {
  return render(<ChakraProvider value={system}>{ui}</ChakraProvider>);
}

describe("RemoteConnectFlow GeoParquet dispatch", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    mockRenderPath = "client";
    mockSizeBytes = 5 * 1024 * 1024;
  });

  it("POSTs render_path=client for small files", async () => {
    mockRenderPath = "client";
    mockSizeBytes = 5 * 1024 * 1024;

    const { RemoteConnectFlow } = await import("../RemoteConnectFlow");
    renderWithChakra(<RemoteConnectFlow onDatasetReady={() => {}} />);

    const input = screen.getByPlaceholderText(/https/i);
    fireEvent.change(input, {
      target: { value: "https://example.com/small.parquet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /scan/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /confirm/i })
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = fetchMock.mock.calls[0] as any;
    const body = JSON.parse(call[1].body);
    expect(body.render_path).toBe("client");
  });

  it("POSTs render_path=server for large files", async () => {
    mockRenderPath = "server";
    mockSizeBytes = 200 * 1024 * 1024;

    const { RemoteConnectFlow } = await import("../RemoteConnectFlow");
    renderWithChakra(<RemoteConnectFlow onDatasetReady={() => {}} />);

    const input = screen.getByPlaceholderText(/https/i);
    fireEvent.change(input, {
      target: { value: "https://example.com/big.parquet" },
    });
    fireEvent.click(screen.getByRole("button", { name: /scan/i }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /confirm/i })
      ).not.toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = fetchMock.mock.calls[0] as any;
    const body = JSON.parse(call[1].body);
    expect(body.render_path).toBe("server");
  });
});
