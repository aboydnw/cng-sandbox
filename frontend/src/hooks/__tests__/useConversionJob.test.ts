import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  extractErrorMessage,
  stripPydanticPrefix,
  useConversionJob,
} from "../useConversionJob";
import { workspaceFetch } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  workspaceFetch: vi.fn(),
}));

describe("stripPydanticPrefix", () => {
  it("strips 'Value error, ' prefix", () => {
    expect(
      stripPydanticPrefix("Value error, Only http and https URLs are supported")
    ).toBe("Only http and https URLs are supported");
  });

  it("leaves messages without prefix unchanged", () => {
    expect(stripPydanticPrefix("File not found")).toBe("File not found");
  });
});

describe("extractErrorMessage", () => {
  it("extracts detail string", () => {
    expect(extractErrorMessage({ detail: "Upload failed" }, "fallback")).toBe(
      "Upload failed"
    );
  });

  it("extracts message string", () => {
    expect(extractErrorMessage({ message: "Server error" }, "fallback")).toBe(
      "Server error"
    );
  });

  it("extracts error string", () => {
    expect(extractErrorMessage({ error: "Bad request" }, "fallback")).toBe(
      "Bad request"
    );
  });

  it("returns fallback when no known keys", () => {
    expect(extractErrorMessage({ foo: "bar" }, "fallback")).toBe("fallback");
  });

  it("handles array of pydantic validation errors", () => {
    const body = {
      detail: [
        { msg: "Value error, Only http URLs supported", type: "value_error" },
        { msg: "Value error, URL too long", type: "value_error" },
      ],
    };
    const result = extractErrorMessage(body, "fallback");
    expect(result).toBe("Only http URLs supported; URL too long");
  });

  it("prefers detail over message over error", () => {
    expect(
      extractErrorMessage({ detail: "d", message: "m", error: "e" }, "f")
    ).toBe("d");
  });
});

class FakeEventSource {
  listeners: Record<string, (e: MessageEvent) => void> = {};
  closed = false;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }
  addEventListener(name: string, fn: (e: MessageEvent) => void) {
    this.listeners[name] = fn;
  }
  close() {
    this.closed = true;
  }
  static instances: FakeEventSource[] = [];
  emit(name: string, data: unknown) {
    this.listeners[name]?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

const mockFetch = vi.mocked(workspaceFetch);
const OriginalEventSource = globalThis.EventSource;

describe("useConversionJob failure paths", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    FakeEventSource.instances = [];
    // @ts-expect-error override
    globalThis.EventSource = FakeEventSource;
  });

  afterEach(() => {
    globalThis.EventSource = OriginalEventSource;
    vi.useRealTimers();
  });

  it("fails the job when the upload request keeps failing", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useConversionJob());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startUpload(
        new File(["x"], "data.tif", { type: "image/tiff" })
      );
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await promise;
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.isUploading).toBe(false);
    expect(result.current.state.error).toMatch(/Upload failed/);
    const uploadStage = result.current.state.stages.find(
      (s) => s.name === "Uploading"
    );
    expect(uploadStage?.status).toBe("error");
  });

  it("fails the job when the URL fetch request keeps failing", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useConversionJob());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startUrlFetch("https://example.com/data.tif");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await promise;
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.isUploading).toBe(false);
    expect(result.current.state.error).toMatch(/Fetch failed/);
  });

  it("fails the job when the temporal upload request keeps failing", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useConversionJob());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startTemporalUpload([
        new File(["x"], "a.tif", { type: "image/tiff" }),
      ]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await promise;
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.isUploading).toBe(false);
  });

  it("fails the job when auto variable confirmation is rejected", async () => {
    mockFetch.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/check-format"))
        return jsonResponse({ valid: true });
      if (url.includes("/api/check-duplicate")) return jsonResponse({});
      if (url.includes("/api/upload"))
        return jsonResponse({ job_id: "j1", dataset_id: "d1" });
      throw new TypeError("Failed to fetch");
    });
    const { result } = renderHook(() => useConversionJob());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.startUpload(
        new File(["x"], "data.nc", { type: "application/netcdf" })
      );
    });
    await act(async () => {
      await promise;
    });

    expect(FakeEventSource.instances.length).toBe(1);
    act(() => {
      FakeEventSource.instances[0].emit("scan_result", {
        scan_id: "s1",
        variables: [
          {
            name: "temp",
            group: "/",
            shape: [10, 10],
            dtype: "float32",
            time_dim: null,
          },
        ],
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.error).toMatch(/Variable selection failed/);
  });

  it("fails the job when column confirmation loses the connection", async () => {
    mockFetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useConversionJob());

    let promise!: Promise<void>;
    act(() => {
      promise = result.current.confirmColumns("s1", {
        lat_column: "lat",
        lon_column: "lon",
        crs: "EPSG:4326",
      });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await promise;
    });

    expect(result.current.state.status).toBe("failed");
    expect(result.current.state.error).toMatch(/Column selection failed/);
  });
});
