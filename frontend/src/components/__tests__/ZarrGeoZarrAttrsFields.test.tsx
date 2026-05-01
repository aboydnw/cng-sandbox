import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { describe, expect, it, vi } from "vitest";
import { ZarrGeoZarrAttrsFields } from "../ZarrGeoZarrAttrsFields";
import type { GeoZarrAttrs } from "../../types";

function wrap(ui: React.ReactNode) {
  return render(<ChakraProvider value={defaultSystem}>{ui}</ChakraProvider>);
}

const ATTRS: GeoZarrAttrs = {
  "spatial:dimensions": ["latitude", "longitude"],
  "spatial:transform": [0.1, 0, -180, 0, 0.1, -90],
  "spatial:shape": [1800, 3600],
  "proj:code": "EPSG:4326",
};

describe("ZarrGeoZarrAttrsFields", () => {
  it("emits null when any required field is empty", () => {
    const onChange = vi.fn();
    wrap(
      <ZarrGeoZarrAttrsFields
        initialAttrs={null}
        storeHasGeoZarrAttrs={false}
        onChange={onChange}
      />
    );
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("emits a parsed override when all fields are valid", () => {
    const onChange = vi.fn();
    wrap(
      <ZarrGeoZarrAttrsFields
        initialAttrs={ATTRS}
        storeHasGeoZarrAttrs={false}
        onChange={onChange}
      />
    );
    expect(onChange).toHaveBeenLastCalledWith(ATTRS);
  });

  it("rejects an invalid EPSG code", () => {
    const onChange = vi.fn();
    wrap(
      <ZarrGeoZarrAttrsFields
        initialAttrs={ATTRS}
        storeHasGeoZarrAttrs={false}
        onChange={onChange}
      />
    );
    fireEvent.change(screen.getByLabelText(/proj:code/i), {
      target: { value: "WGS84" },
    });
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByText(/EPSG:/)).toBeInTheDocument();
  });

  it("starts collapsed when the store already has GeoZarr attrs", () => {
    wrap(
      <ZarrGeoZarrAttrsFields
        initialAttrs={null}
        storeHasGeoZarrAttrs={true}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByLabelText(/proj:code/i)).toBeNull();
    expect(
      screen.getByText(/already has GeoZarr metadata/i)
    ).toBeInTheDocument();
  });

  it("starts expanded when the store is missing GeoZarr attrs", () => {
    wrap(
      <ZarrGeoZarrAttrsFields
        initialAttrs={null}
        storeHasGeoZarrAttrs={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText(/proj:code/i)).toBeInTheDocument();
  });
});
