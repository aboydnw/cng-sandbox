import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { ZarrConnectionFields } from "../ZarrConnectionFields";
import type { ZarrProbeResult } from "../../lib/zarr/probeZarr";

const PROBE_4D: ZarrProbeResult = {
  variables: [
    {
      name: "reflectance",
      shape: [4, 3, 100, 100],
      dimNames: ["time", "band", "y", "x"],
      dtype: "float32",
      attrs: { valid_min: 0, valid_max: 1 },
      stats: { min: 0, max: 1 },
      timeDim: "time",
      timesteps: null,
      extraDim: "band",
      extraLabels: ["B02", "B03", "B04"],
      compatibility: { kind: "ok" },
    },
  ],
  crsWarning: null,
  rootAttrs: null,
};

describe("ZarrConnectionFields — band picker", () => {
  it("renders a band picker for a 4D variable and emits the chosen index", () => {
    const onConfigChange = vi.fn();
    render(
      <ChakraProvider value={defaultSystem}>
        <ZarrConnectionFields
          probe={PROBE_4D}
          onConfigChange={onConfigChange}
        />
      </ChakraProvider>
    );

    const bandSelect = screen.getByLabelText("band") as HTMLSelectElement;
    expect(bandSelect).toBeInTheDocument();
    expect(Array.from(bandSelect.options).map((o) => o.text)).toEqual([
      "B02",
      "B03",
      "B04",
    ]);

    fireEvent.change(bandSelect, { target: { value: "2" } });

    const lastCall =
      onConfigChange.mock.calls[onConfigChange.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject({
      variable: "reflectance",
      extraDim: "band",
      extraIndex: 2,
    });
  });
});
