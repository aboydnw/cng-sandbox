import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "../../../theme";
import { createFlyoverChapter } from "../../../lib/story/types";
import { FlyoverKeyframePanel } from "../FlyoverKeyframePanel";

const camera = { longitude: 10, latitude: 20, zoom: 8, bearing: 45, pitch: 60 };

const chapter = createFlyoverChapter({
  keyframes: [
    { center: [0, 0], zoom: 4, bearing: 0, pitch: 0, caption: "a" },
    { center: [1, 1], zoom: 5, bearing: 10, pitch: 10 },
  ],
  map_state: {
    center: [0, 0],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    basemap: "satellite",
    terrain: { enabled: true, exaggeration: 2 },
    buildings: true,
  },
});

function renderPanel(onChange = vi.fn(), onPreviewPose = vi.fn()) {
  render(
    <ChakraProvider value={system}>
      <FlyoverKeyframePanel
        chapter={chapter}
        onChange={onChange}
        currentCamera={camera}
        onPreviewPose={onPreviewPose}
      />
    </ChakraProvider>
  );
  return { onChange, onPreviewPose };
}

describe("FlyoverKeyframePanel", () => {
  it("adds a keyframe from the current view, preserving every other chapter field", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(
      screen.getByRole("button", { name: /add keyframe from current view/i })
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0][0];
    expect(next.keyframes).toHaveLength(3);
    expect(next.keyframes[2].center).toEqual([10, 20]);
    // Autosave-wipe regression: 3D map_state must survive keyframe edits.
    expect(next.map_state.terrain).toEqual({ enabled: true, exaggeration: 2 });
    expect(next.map_state.buildings).toBe(true);
    expect(next.map_state.basemap).toBe("satellite");
    expect(next.scroll_length).toBe(chapter.scroll_length);
    expect(next.id).toBe(chapter.id);
  });

  it("deletes a keyframe", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(
      screen.getAllByRole("button", { name: /delete keyframe/i })[0]
    );
    expect(onChange.mock.calls[0][0].keyframes).toHaveLength(1);
  });

  it("jump-to previews the keyframe pose", async () => {
    const { onPreviewPose } = renderPanel();
    await userEvent.click(
      screen.getAllByRole("button", { name: /jump to keyframe/i })[1]
    );
    expect(onPreviewPose).toHaveBeenCalledWith(
      { center: [1, 1], zoom: 5, bearing: 10, pitch: 10 },
      true
    );
  });

  it("shows the <2-keyframe hint only when under 2 keyframes", () => {
    render(
      <ChakraProvider value={system}>
        <FlyoverKeyframePanel
          chapter={createFlyoverChapter()}
          onChange={vi.fn()}
          currentCamera={camera}
          onPreviewPose={vi.fn()}
        />
      </ChakraProvider>
    );
    expect(screen.getByText(/at least 2 keyframes/i)).toBeInTheDocument();
  });

  it("scrubbing the preview slider drives the shared interpolator", async () => {
    const { onPreviewPose } = renderPanel();
    const slider = screen.getByRole("slider", { name: /preview flyover/i });
    expect(slider).toBeInTheDocument();
    // jsdom range inputs don't step on ArrowRight; fire the change directly.
    fireEvent.change(slider, { target: { value: "250" } });
    expect(onPreviewPose).toHaveBeenCalled();
    const [pose] = onPreviewPose.mock.calls[0];
    expect(pose.zoom).toBeGreaterThanOrEqual(4);
    expect(pose.zoom).toBeLessThanOrEqual(5);
  });

  it("Orbit appends 5 keyframes from the current view", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /^orbit$/i }));
    const next = onChange.mock.calls[0][0];
    expect(next.keyframes).toHaveLength(chapter.keyframes.length + 5);
    expect(next.keyframes.at(-1)!.center).toEqual([10, 20]); // current camera center
  });

  it("Approach appends 3 keyframes ending at the current view", async () => {
    const { onChange } = renderPanel();
    await userEvent.click(screen.getByRole("button", { name: /^approach$/i }));
    const next = onChange.mock.calls[0][0];
    expect(next.keyframes).toHaveLength(chapter.keyframes.length + 3);
    expect(next.keyframes.at(-1)!.zoom).toBe(8);
  });

  it("shows a soft zoom-gap warning for >3-level jumps", () => {
    const gappy = createFlyoverChapter({
      keyframes: [
        { center: [0, 0], zoom: 2, bearing: 0, pitch: 0 },
        { center: [0, 0], zoom: 9, bearing: 0, pitch: 0 },
      ],
    });
    render(
      <ChakraProvider value={system}>
        <FlyoverKeyframePanel
          chapter={gappy}
          onChange={vi.fn()}
          currentCamera={camera}
          onPreviewPose={vi.fn()}
        />
      </ChakraProvider>
    );
    expect(screen.getByText(/tiles may pop in/i)).toBeInTheDocument();
  });
});
