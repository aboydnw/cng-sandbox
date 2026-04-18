import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { RenderModeIndicator } from "../RenderModeIndicator";

function wrap(ui: React.ReactElement) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

describe("RenderModeIndicator", () => {
  it("renders an info icon button with snapshot-overlay data attribute", () => {
    const { container } = wrap(
      <RenderModeIndicator
        renderMode="client"
        reason="COG under 500 MB cap"
        sizeBytes={184 * 1024 * 1024}
      />
    );
    const el = container.querySelector("[data-snapshot-overlay]");
    expect(el).not.toBeNull();
  });

  it("shows client copy in the popover when clicked", () => {
    wrap(
      <RenderModeIndicator
        renderMode="client"
        reason="COG under 500 MB cap"
        sizeBytes={184 * 1024 * 1024}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /render mode/i }));
    expect(screen.getByText(/client \(browser\)/i)).toBeInTheDocument();
    expect(screen.getByText(/184\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/under 500 MB cap/i)).toBeInTheDocument();
  });

  it("shows server copy in the popover when clicked", () => {
    wrap(
      <RenderModeIndicator
        renderMode="server"
        reason="File exceeds 500 MB client-render cap"
        sizeBytes={1.2 * 1024 * 1024 * 1024}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /render mode/i }));
    expect(screen.getByText(/server tiles/i)).toBeInTheDocument();
    expect(screen.getByText(/1\.2 GB/)).toBeInTheDocument();
  });

  it("omits size line when sizeBytes is null", () => {
    wrap(
      <RenderModeIndicator
        renderMode="server"
        reason="Temporal dataset requires server-side tiling"
        sizeBytes={null}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /render mode/i }));
    expect(screen.queryByText(/file size/i)).not.toBeInTheDocument();
    expect(screen.getByText(/temporal/i)).toBeInTheDocument();
  });
});
