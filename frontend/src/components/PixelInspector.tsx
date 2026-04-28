import { useState, useCallback, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";

type TileBbox =
  | { west: number; south: number; east: number; north: number }
  | { left: number; top: number; right: number; bottom: number };

type ProjectFrom4326 = (lng: number, lat: number) => [number, number];
type InverseTransform = (srcX: number, srcY: number) => [number, number];

interface HoverSourceTile {
  index: { x: number; y: number; z?: number };
  /**
   * deck.gl v9 Tile2DHeader.boundingBox: `[[minX, minY], [maxX, maxY]]`.
   * This is the non-deprecated extent accessor and is always populated by
   * the tileset at construction time.
   */
  boundingBox?: [number[], number[]];
  /** Legacy/alternate shape returned by some tileset implementations. */
  bbox?: TileBbox;
  content?: {
    /**
     * Affine inverse from deck.gl-geotiff: maps source-CRS coordinates within
     * a tile to pixel coordinates `[col, row]` within that tile's grid.
     * Present on COGLayer-rendered tiles (paletted + continuous builders).
     */
    inverseTransform?: InverseTransform;
    data?: {
      raw?: ArrayLike<number>;
      width?: number;
      height?: number;
      /**
       * Reprojector from EPSG:4326 (lng/lat) to the COG's source CRS.
       * Attached by `buildCogLayerPaletted` / `buildCogLayerContinuous` once
       * `onGeoTIFFLoad` resolves the COG's CRS. Required for accurate hover
       * sampling on non-Mercator COGs (linear lng/lat interpolation across
       * the tile's lng/lat AABB picks the wrong pixel for projections with
       * curved parallels — Albers, polar stereographic, etc.).
       */
      projectFrom4326?: ProjectFrom4326 | null;
    };
  };
}

function resolveTileExtent(
  sourceTile: HoverSourceTile
): [number, number, number, number] | null {
  const bb = sourceTile.boundingBox;
  if (bb && bb[0]?.length >= 2 && bb[1]?.length >= 2) {
    const [[minX, minY], [maxX, maxY]] = bb;
    if ([minX, minY, maxX, maxY].every((v) => typeof v === "number")) {
      return [minX, minY, maxX, maxY];
    }
  }
  const bbox = sourceTile.bbox;
  if (bbox) {
    if ("west" in bbox) return [bbox.west, bbox.south, bbox.east, bbox.north];
    if ("left" in bbox)
      return [
        bbox.left,
        Math.min(bbox.top, bbox.bottom),
        bbox.right,
        Math.max(bbox.top, bbox.bottom),
      ];
  }
  return null;
}

interface DeckHoverInfo {
  x: number;
  y: number;
  coordinate?: [number, number];
  sourceTile?: HoverSourceTile;
}

function lookupValue(
  sourceTile: HoverSourceTile,
  lng: number,
  lat: number
): number | null {
  const data = sourceTile.content?.data;
  const raw = data?.raw;
  const width = data?.width;
  const height = data?.height;
  if (!raw || !width || !height) return null;

  // Preferred path: use the COG's source CRS to translate lng/lat into the
  // tile's pixel grid. The lng/lat AABB of a non-Mercator tile is a curvy
  // quadrilateral, so linear interpolation across the AABB picks the wrong
  // pixel. Projecting through `projectFrom4326` + the per-tile affine inverse
  // is exact regardless of the source projection.
  const projectFrom4326 = data.projectFrom4326;
  const inverseTransform = sourceTile.content?.inverseTransform;
  if (projectFrom4326 && inverseTransform) {
    const [srcX, srcY] = projectFrom4326(lng, lat);
    if (
      !Number.isFinite(srcX) ||
      !Number.isFinite(srcY) ||
      Number.isNaN(srcX) ||
      Number.isNaN(srcY)
    ) {
      return null;
    }
    const [pxFloat, pyFloat] = inverseTransform(srcX, srcY);
    if (
      !Number.isFinite(pxFloat) ||
      !Number.isFinite(pyFloat) ||
      Number.isNaN(pxFloat) ||
      Number.isNaN(pyFloat)
    ) {
      return null;
    }
    if (pxFloat < 0 || pxFloat >= width || pyFloat < 0 || pyFloat >= height) {
      return null;
    }
    const px = Math.min(width - 1, Math.max(0, Math.floor(pxFloat)));
    const py = Math.min(height - 1, Math.max(0, Math.floor(pyFloat)));
    const val = raw[py * width + px];
    if (Number.isNaN(val)) return null;
    return val;
  }

  // Fallback: linear lng/lat interpolation. Exact for identity projections,
  // a reasonable approximation for Web Mercator at small tile spans, and
  // wrong for projections with curved parallels — but kept so callers without
  // a projector (tests, server-tile inspector mocks) still get a value.
  const extent = resolveTileExtent(sourceTile);
  if (!extent) return null;
  const [west, south, east, north] = extent;
  const spanX = east - west;
  const spanY = north - south;
  if (spanX <= 0 || spanY <= 0) return null;
  if (lng < west || lng > east || lat < south || lat > north) return null;

  // Clamp to [0, dim-1]: coordinates exactly on the east/south edge would
  // otherwise land at `width`/`height` and drop the tooltip at tile seams.
  const px = Math.min(
    width - 1,
    Math.max(0, Math.floor(((lng - west) / spanX) * width))
  );
  const py = Math.min(
    height - 1,
    Math.max(0, Math.floor(((north - lat) / spanY) * height))
  );

  const val = raw[py * width + px];
  if (val !== val) return null;
  return val;
}

function formatCoord(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${latDir}, ${Math.abs(lng).toFixed(4)}°${lngDir}`;
}

function formatValue(value: number): string {
  if (Math.abs(value) >= 1000) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  if (Math.abs(value) >= 0.01) return value.toFixed(4);
  return value.toPrecision(4);
}

type HoverInfo =
  | {
      kind: "numeric";
      x: number;
      y: number;
      lng: number;
      lat: number;
      value: number;
      bandName: string | null;
    }
  | {
      kind: "categorical";
      x: number;
      y: number;
      lng: number;
      lat: number;
      value: number;
      label: string;
      color: string;
    };

export function usePixelInspector(
  bandNames: string[] | null,
  categories?: { value: number; color: string; label: string }[]
) {
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const hoverRafRef = useRef<number | null>(null);

  const onHover = useCallback(
    (info: DeckHoverInfo) => {
      if (hoverRafRef.current !== null) {
        cancelAnimationFrame(hoverRafRef.current);
      }
      if (!info.coordinate || !info.sourceTile) {
        hoverRafRef.current = null;
        setHoverInfo(null);
        return;
      }
      const sourceTile = info.sourceTile;
      hoverRafRef.current = requestAnimationFrame(() => {
        hoverRafRef.current = null;
        const [lng, lat] = info.coordinate!;
        const value = lookupValue(sourceTile, lng, lat);
        if (value === null) {
          setHoverInfo(null);
          return;
        }
        if (categories && categories.length > 0) {
          const match = categories.find((c) => c.value === Math.round(value));
          if (!match) {
            setHoverInfo(null);
            return;
          }
          setHoverInfo({
            kind: "categorical",
            x: info.x,
            y: info.y,
            lng,
            lat,
            value: match.value,
            label: match.label,
            color: match.color,
          });
          return;
        }
        setHoverInfo({
          kind: "numeric",
          x: info.x,
          y: info.y,
          lng,
          lat,
          value,
          bandName: bandNames?.[0]?.match(/^Band \d+$/i)
            ? null
            : (bandNames?.[0] ?? null),
        });
      });
    },
    [bandNames, categories]
  );

  return { hoverInfo, onHover };
}

interface CategoricalPixelTooltipProps {
  hoverInfo: Extract<HoverInfo, { kind: "categorical" }>;
}

export function CategoricalPixelTooltip({
  hoverInfo,
}: CategoricalPixelTooltipProps) {
  return (
    <Box
      position="absolute"
      left={`${hoverInfo.x + 14}px`}
      top={`${hoverInfo.y - 32}px`}
      bg="rgba(15, 23, 42, 0.88)"
      backdropFilter="blur(8px)"
      borderRadius="6px"
      border="1px solid rgba(255,255,255,0.08)"
      shadow="lg"
      px={2.5}
      py={1.5}
      pointerEvents="none"
      zIndex={10}
      whiteSpace="nowrap"
      display="flex"
      alignItems="center"
      gap={2}
    >
      <Box
        data-testid="categorical-swatch"
        width="10px"
        height="10px"
        borderRadius="2px"
        bg={hoverInfo.color}
      />
      <Text fontSize="13px" fontWeight={600} color="white" lineHeight="1.2">
        {hoverInfo.label}
      </Text>
    </Box>
  );
}

interface PixelInspectorTooltipProps {
  hoverInfo: Extract<HoverInfo, { kind: "numeric" }>;
}

export function PixelInspectorTooltip({
  hoverInfo,
}: PixelInspectorTooltipProps) {
  return (
    <Box
      position="absolute"
      left={`${hoverInfo.x + 14}px`}
      top={`${hoverInfo.y - 44}px`}
      bg="rgba(15, 23, 42, 0.88)"
      backdropFilter="blur(8px)"
      borderRadius="6px"
      border="1px solid rgba(255,255,255,0.08)"
      shadow="lg"
      px={2.5}
      py={1.5}
      pointerEvents="none"
      zIndex={10}
      whiteSpace="nowrap"
    >
      <Text
        fontSize="13px"
        fontWeight={600}
        fontFamily="mono"
        color="white"
        lineHeight="1.2"
      >
        {formatValue(hoverInfo.value)}
        {hoverInfo.bandName && (
          <Text
            as="span"
            fontSize="11px"
            fontWeight={400}
            color="whiteAlpha.600"
            ml={1.5}
          >
            {hoverInfo.bandName}
          </Text>
        )}
      </Text>
      <Text
        fontSize="10px"
        fontFamily="mono"
        color="whiteAlpha.500"
        mt={0.5}
        lineHeight="1.2"
      >
        {formatCoord(hoverInfo.lat, hoverInfo.lng)}
      </Text>
    </Box>
  );
}
