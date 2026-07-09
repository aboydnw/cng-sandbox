import { describe, it, expect } from "vitest";
import { resolveCameraCommand } from "../mapCamera";

const camera = {
  longitude: -30,
  latitude: 12,
  zoom: 5,
  bearing: 20,
  pitch: 45,
};

describe("resolveCameraCommand", () => {
  it("uses jumpTo with no duration when transitionDuration is undefined", () => {
    const cmd = resolveCameraCommand(camera, undefined);
    expect(cmd.method).toBe("jumpTo");
    expect(cmd.options).toEqual({
      center: [-30, 12],
      zoom: 5,
      bearing: 20,
      pitch: 45,
    });
  });

  it("uses flyTo with the given duration when transitionDuration is set", () => {
    const cmd = resolveCameraCommand(camera, 2500);
    expect(cmd.method).toBe("flyTo");
    expect(cmd.options.duration).toBe(2500);
    expect(cmd.options.center).toEqual([-30, 12]);
  });

  it("treats a zero duration as an instant jumpTo", () => {
    const cmd = resolveCameraCommand(camera, 0);
    expect(cmd.method).toBe("jumpTo");
    expect("duration" in cmd.options).toBe(false);
  });
});
