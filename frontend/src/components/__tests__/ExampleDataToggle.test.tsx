import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { ExampleDataToggle } from "../ExampleDataToggle";
import * as examplesApi from "../../lib/examples/api";

vi.mock("../../hooks/useWorkspace", () => ({
  useWorkspace: () => ({
    workspaceId: "ws1",
    isHomeWorkspace: true,
    workspacePath: (p: string) => `/w/ws1${p}`,
  }),
}));

function renderToggle(onChanged = () => {}) {
  return render(
    <ChakraProvider value={system}>
      <ExampleDataToggle onChanged={onChanged} />
    </ChakraProvider>
  );
}

describe("ExampleDataToggle", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("shows Remove when seeded", async () => {
    vi.spyOn(examplesApi, "getExampleState").mockResolvedValue({
      state: "seeded",
    });
    renderToggle();
    expect(await screen.findByText(/remove example data/i)).toBeInTheDocument();
  });

  it("adds example data when removed", async () => {
    vi.spyOn(examplesApi, "getExampleState").mockResolvedValue({
      state: "removed",
    });
    const seed = vi
      .spyOn(examplesApi, "seedExampleData")
      .mockResolvedValue({ state: "seeded", story_id_map: {} });
    const onChanged = vi.fn();
    renderToggle(onChanged);
    fireEvent.click(await screen.findByText(/add example data/i));
    await waitFor(() => expect(seed).toHaveBeenCalledWith("ws1"));
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
  });
});
