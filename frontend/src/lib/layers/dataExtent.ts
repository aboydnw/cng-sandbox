import { PathLayer } from "@deck.gl/layers";
import { PathStyleExtension } from "@deck.gl/extensions";
import { BRAND_COLOR_RGBA } from "../../components/MapShell";

const OUTLINE_COLOR: [number, number, number, number] = [
  BRAND_COLOR_RGBA[0],
  BRAND_COLOR_RGBA[1],
  BRAND_COLOR_RGBA[2],
  220,
];

/**
 * Whether to indicate that data exists but its tiles aren't visible at the
 * current zoom level. True only when the layer's min zoom is known, positive,
 * and the camera hasn't zoomed in far enough to load tiles yet.
 */
export function shouldShowZoomPrompt(
  currentZoom: number,
  minZoom: number | null | undefined
): boolean {
  if (minZoom == null || !Number.isFinite(minZoom) || minZoom <= 0) {
    return false;
  }
  return currentZoom < minZoom;
}

/** Center point of a [west, south, east, north] bounding box. */
export function boundsCenter(
  bounds: [number, number, number, number]
): [number, number] {
  const [west, south, east, north] = bounds;
  return [(west + east) / 2, (south + north) / 2];
}

/**
 * A dashed rectangle outlining the data extent, shown while the camera is
 * below the layer's min zoom so users can see where data lives before its
 * tiles load.
 */
export function buildExtentOutlineLayer(
  bounds: [number, number, number, number],
  id = "data-extent-outline"
) {
  const [west, south, east, north] = bounds;
  return new PathLayer({
    id,
    data: [
      {
        path: [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ] as [number, number][],
      },
    ],
    getPath: (d: { path: [number, number][] }) => d.path,
    getColor: OUTLINE_COLOR,
    getWidth: 2,
    widthUnits: "pixels",
    getDashArray: [6, 4],
    extensions: [new PathStyleExtension({ dash: true })],
    pickable: false,
  });
}
