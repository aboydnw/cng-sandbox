import { fireEvent, render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, expect, it, vi } from "vitest";
import { system } from "../../../theme";
import { StatePanel } from "../StatePanel";

function renderPanel(panel: React.ReactNode) {
  return render(<ChakraProvider value={system}>{panel}</ChakraProvider>);
}

describe("StatePanel", () => {
  it("announces danger states as alerts and invokes recovery actions", () => {
    const onAction = vi.fn();

    renderPanel(
      <StatePanel
        tone="danger"
        title="Couldn’t load your stories"
        description="Request failed"
        actionLabel="Try again"
        onAction={onAction}
      />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn’t load your stories"
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("accepts a routed action without nesting it in another button", () => {
    renderPanel(
      <StatePanel
        title="No stories yet"
        action={<a href="/story/new">Create a story</a>}
      />
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a story" })
    ).toHaveAttribute("href", "/story/new");
  });
});
