import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../theme";
import { TrajectoryControls } from "../TrajectoryControls";

function renderControls(over = {}) {
  const props = {
    currentTime: 500,
    tMin: 0,
    tMax: 1000,
    isPlaying: false,
    speed: 1,
    onTogglePlay: vi.fn(),
    onSetSpeed: vi.fn(),
    onScrub: vi.fn(),
    ...over,
  };
  render(
    <ChakraProvider value={system}>
      <TrajectoryControls {...props} />
    </ChakraProvider>
  );
  return props;
}

describe("TrajectoryControls", () => {
  it("toggles play", () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole("button", { name: /play/i }));
    expect(props.onTogglePlay).toHaveBeenCalled();
  });

  it("scrubs on range change", () => {
    const props = renderControls();
    fireEvent.change(screen.getByRole("slider"), { target: { value: "250" } });
    expect(props.onScrub).toHaveBeenCalledWith(250);
  });
});
