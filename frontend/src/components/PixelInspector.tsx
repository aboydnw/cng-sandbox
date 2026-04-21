import { useState, useCallback, useRef } from "react";
import { Box, Text } from "@chakra-ui/react";
import type { TileCacheEntry } from "../lib/layers/cogLayer";

interface HoverSourceTile {
  index: { x: number; y: number; z?: number };
  bounds: [number, number, number, number] | number[];
  content?: {
    data?: {
      raw?: ArrayLike<number>;
      width?: number;
      height?: number;
    };
  };
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

  const [west, south, east, north] = sourceTile.bounds as [
    number,
    number,
    number,
    number,
  ];
  if (lng < west || lng > east || lat < south || lat > north) return null;

  const px = Math.floor(((lng - west) / (east - west)) * width);
  const py = Math.floor(((north - lat) / (north - south)) * height);
  if (px < 0 || px >= width || py < 0 || py >= height) return null;

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
  _tileCacheRef: React.MutableRefObject<Map<string, TileCacheEntry>>,
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
