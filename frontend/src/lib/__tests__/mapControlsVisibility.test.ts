import { describe, expect, it } from "vitest";
import { shouldShowMobileMapControls } from "../mapControlsVisibility";

describe("mobile map controls visibility", () => {
  it("keeps controls available on shared point-cloud maps", () => {
    expect(shouldShowMobileMapControls(true, true)).toBe(true);
  });

  it("keeps read-only controls hidden for other shared maps", () => {
    expect(shouldShowMobileMapControls(true, false)).toBe(false);
  });
});
