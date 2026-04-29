import { useEffect, useState } from "react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import * as zarr from "zarrita";
import { buildZarrLayer } from "../lib/layers/zarrLayer";

const ZARR_URL =
  "https://data.source.coop/dynamical/ecmwf-ifs-ens-forecast-15-day-0-25-degree/v0.1.0.zarr";
const VARIABLE = "temperature_2m";

const INITIAL_VIEW = {
  longitude: 0,
  latitude: 20,
  zoom: 1,
  pitch: 0,
  bearing: 0,
};

export default function DevZarrSpike() {
  const [node, setNode] = useState<zarr.Group<zarr.Readable> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const store = new zarr.FetchStore(ZARR_URL);
    zarr
      .open(store, { kind: "group" })
      .then((g) => setNode(g as zarr.Group<zarr.Readable>))
      .catch((e) => {
        console.error("[zarr-spike] failed to open store", e);
        setError(String(e));
      });
  }, []);

  const layers = node
    ? buildZarrLayer({
        node,
        variable: VARIABLE,
        selection: { time: 0, lead_time: 0, ensemble_member: 0 },
        opacity: 0.85,
        rescaleMin: 220,
        rescaleMax: 320,
      })
    : [];

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {error && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 10,
            background: "rgba(255, 255, 255, 0.9)",
            padding: "8px 12px",
            fontFamily: "monospace",
            maxWidth: 600,
          }}
        >
          Error: {error}
        </div>
      )}
      {!node && !error && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            zIndex: 10,
            background: "rgba(255, 255, 255, 0.9)",
            padding: "8px 12px",
            fontFamily: "monospace",
          }}
        >
          Opening Zarr store…
        </div>
      )}
      <DeckGL initialViewState={INITIAL_VIEW} controller layers={layers}>
        <Map mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" />
      </DeckGL>
    </div>
  );
}
