import { renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ChakraProvider } from "@chakra-ui/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WorkspaceProvider, useOptionalWorkspace } from "../useWorkspace";
import { system } from "../../theme";

const getExampleState = vi.fn();
const seedExampleData = vi.fn();

vi.mock("../../lib/examples/api", () => ({
  getExampleState: (...args: unknown[]) => getExampleState(...args),
  seedExampleData: (...args: unknown[]) => seedExampleData(...args),
}));

beforeEach(() => {
  getExampleState.mockReset();
  seedExampleData.mockReset();
  getExampleState.mockResolvedValue({ state: "seeded" });
  seedExampleData.mockResolvedValue({ state: "seeded", story_id_map: {} });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider value={system}>
      <MemoryRouter initialEntries={["/w/testws/map/123"]}>
        <Routes>
          <Route
            path="/w/:workspaceId/*"
            element={<WorkspaceProvider>{children}</WorkspaceProvider>}
          />
        </Routes>
      </MemoryRouter>
    </ChakraProvider>
  );
}

function bareWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

test("useOptionalWorkspace returns context inside WorkspaceProvider", async () => {
  const { result } = renderHook(() => useOptionalWorkspace(), { wrapper });
  await waitFor(() => expect(result.current).not.toBeNull());
  expect(result.current!.workspaceId).toBe("testws");
});

test("seeds examples before mounting a previously untouched workspace", async () => {
  getExampleState.mockResolvedValueOnce({ state: "none" });

  const { result } = renderHook(() => useOptionalWorkspace(), { wrapper });

  await waitFor(() => expect(result.current).not.toBeNull());
  await waitFor(() => expect(seedExampleData).toHaveBeenCalledWith("testws"));
});

test("preserves a workspace whose examples were explicitly removed", async () => {
  getExampleState.mockResolvedValueOnce({ state: "removed" });

  const { result } = renderHook(() => useOptionalWorkspace(), { wrapper });

  await waitFor(() => expect(result.current).not.toBeNull());
  expect(seedExampleData).not.toHaveBeenCalled();
});

test("reports a failed example seed instead of swallowing it", async () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  getExampleState.mockResolvedValueOnce({ state: "none" });
  seedExampleData.mockRejectedValueOnce(new Error("HTTP 500"));

  const { result } = renderHook(() => useOptionalWorkspace(), { wrapper });

  await waitFor(() => expect(result.current).not.toBeNull());
  await waitFor(() =>
    expect(consoleError).toHaveBeenCalledWith("Example data setup failed", {
      workspaceId: "testws",
      error: expect.any(Error),
    })
  );
  expect(result.current!.workspaceId).toBe("testws");
});

test("useOptionalWorkspace returns null outside WorkspaceProvider", () => {
  const { result } = renderHook(() => useOptionalWorkspace(), {
    wrapper: bareWrapper,
  });
  expect(result.current).toBeNull();
});
