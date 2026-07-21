import { useId, useState } from "react";
import { Box, Button } from "@chakra-ui/react";
import { CaretDown, CaretRight } from "@phosphor-icons/react";
import { CategoricalLegend } from "./CategoricalLegend";
import { ContinuousRamp } from "./ContinuousRamp";
import { LegendItem } from "./LegendItem";
import { RgbLegend } from "./RgbLegend";
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
  const contentId = useId();

  return (
    <Box
      position="absolute"
      {...POSITION_STYLES[position]}
      zIndex={10}
      minW="200px"
      maxW="400px"
      rounded="panel"
      borderWidth="1px"
      borderColor="map.controlBorder"
      bg="rgba(255,255,255,0.94)"
      boxShadow="md"
      className={className}
      role="region"
      aria-label="Map legend"
      _dark={{ bg: "rgba(30,30,30,0.95)", borderColor: "gray.700" }}
    >
      {collapsible ? (
        <Button
          variant="ghost"
          width="100%"
          justifyContent="space-between"
          borderRadius="panel"
          px={3}
          fontSize="10px"
          textTransform="uppercase"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-controls={contentId}
        >
          <span>Legend</span>
          {collapsed ? <CaretRight size={12} /> : <CaretDown size={12} />}
        </Button>
      ) : null}

      {!collapsed ? (
        <Box id={contentId} p={3} display="flex" flexDirection="column" gap={2}>
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
              ) : layer.type === "rgb" ? (
                <RgbLegend config={layer} />
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
