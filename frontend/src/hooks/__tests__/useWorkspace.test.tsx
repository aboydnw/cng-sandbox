import { renderHook } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceProvider, useOptionalWorkspace } from "../useWorkspace";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/w/testws/map/123"]}>
      <Routes>
        <Route
          path="/w/:workspaceId/*"
          element={<WorkspaceProvider>{children}</WorkspaceProvider>}
        />
      </Routes>
    </MemoryRouter>
  );
}

function bareWrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

test("useOptionalWorkspace returns context inside WorkspaceProvider", () => {
  const { result } = renderHook(() => useOptionalWorkspace(), { wrapper });
  expect(result.current).not.toBeNull();
  expect(result.current!.workspaceId).toBe("testws");
});

test("useOptionalWorkspace returns null outside WorkspaceProvider", () => {
  const { result } = renderHook(() => useOptionalWorkspace(), {
    wrapper: bareWrapper,
  });
  expect(result.current).toBeNull();
});
