import { useState } from "react";
import { Box } from "@chakra-ui/react";
import { CategoricalLegend } from "./CategoricalLegend";
import { ContinuousRamp } from "./ContinuousRamp";
import { LegendItem } from "./LegendItem";
import type { MapLegendProps } from "./types";

const POSITION_STYLES: Record<
  NonNullable<MapLegendProps["position"]>,
  object
> = {
  "top-left": { top: 2, left: 2 },
  "top-right": { top: 2, right: 2 },
  "bottom-left": { bottom: 8, left: 2 },
  "bottom-right": { bottom: 8, right: 2 },
};

const collapseButtonStyle: React.CSSProperties = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  color: "#6b7280",
  background: "none",
  border: "none",
  cursor: "pointer",
};

export function MapLegend({
  layers,
  orientation = "vertical",
  position = "bottom-left",
  collapsible = true,
  collapsibleItems = true,
  defaultCollapsed = false,
  headingLevel = 3,
  onLayerToggle,
  className,
}: MapLegendProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <Box
      position="absolute"
      {...POSITION_STYLES[position]}
      zIndex={10}
      maxW="280px"
      rounded="md"
      borderWidth="1px"
      borderColor="gray.200"
      bg="rgba(255,255,255,0.9)"
      boxShadow="lg"
      className={className}
      role="region"
      aria-label="Map legend"
      _dark={{ bg: "rgba(30,30,30,0.95)", borderColor: "gray.700" }}
    >
      {collapsible ? (
        <button
          type="button"
          style={collapseButtonStyle}
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-controls="maptool-legend-content"
        >
          <span>Legend</span>
          <span>{collapsed ? "▸" : "▾"}</span>
        </button>
      ) : null}

      {!collapsed ? (
        <Box
          id="maptool-legend-content"
          p={3}
          display="flex"
          flexDirection="column"
          gap={2}
        >
          {layers.map((layer) => (
            <LegendItem
              key={layer.id}
              config={layer}
              collapsible={collapsibleItems}
              headingLevel={Math.min(headingLevel + 1, 6) as 3 | 4 | 5 | 6}
              onToggle={
                layer.toggler && onLayerToggle
                  ? (visible) => onLayerToggle(layer.id, visible)
                  : undefined
              }
            >
              {layer.type === "continuous" ? (
                <ContinuousRamp config={layer} orientation={orientation} />
              ) : (
                <CategoricalLegend config={layer} />
              )}
            </LegendItem>
          ))}
        </Box>
      ) : null}
    </Box>
  );
}
