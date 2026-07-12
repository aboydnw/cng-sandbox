import { Box, Button, Flex, IconButton, Text } from "@chakra-ui/react";
import { Eye, EyeSlash, Plus, X } from "@phosphor-icons/react";
import type { OverlayConfig } from "../lib/story/types";
import type { Dataset, Connection } from "../types";

interface OverlayLayersEditorProps {
  overlays: OverlayConfig[];
  datasets: Dataset[];
  connections: Connection[];
  onChange: (overlays: OverlayConfig[]) => void;
  onAddClick: () => void;
}

function overlayName(
  o: OverlayConfig,
  datasets: Dataset[],
  connections: Connection[]
): string {
  if (o.dataset_id) {
    return datasets.find((d) => d.id === o.dataset_id)?.filename ?? "Layer";
  }
  if (o.connection_id) {
    return connections.find((c) => c.id === o.connection_id)?.name ?? "Layer";
  }
  return "Layer";
}

const numberInputStyle: React.CSSProperties = {
  width: "56px",
  height: "28px",
  padding: "0 6px",
  border: "1px solid var(--chakra-colors-brand-border)",
  borderRadius: "6px",
  fontSize: "13px",
  background: "white",
};

export function OverlayLayersEditor({
  overlays,
  datasets,
  connections,
  onChange,
  onAddClick,
}: OverlayLayersEditorProps) {
  const patch = (i: number, next: Partial<OverlayConfig>) =>
    onChange(overlays.map((o, idx) => (idx === i ? { ...o, ...next } : o)));
  const remove = (i: number) =>
    onChange(overlays.filter((_, idx) => idx !== i));

  return (
    <Box px={4} pb={4}>
      <Text fontSize="sm" fontWeight={600} color="brand.brown" mb={2}>
        Overlay layers
      </Text>
      <Flex direction="column" gap={2}>
        {overlays.map((o, i) => {
          const visible = o.visible !== false;
          return (
            <Flex
              key={i}
              align="center"
              gap={2}
              p={2}
              borderWidth="1px"
              borderColor="brand.border"
              borderRadius="md"
            >
              <IconButton
                aria-label={visible ? "Hide overlay" : "Show overlay"}
                size="xs"
                variant="ghost"
                color="brand.brown"
                _hover={{ bg: "brand.bgSubtle" }}
                onClick={() => patch(i, { visible: !visible })}
              >
                {visible ? (
                  <Eye size={16} weight="bold" />
                ) : (
                  <EyeSlash size={16} weight="bold" />
                )}
              </IconButton>
              <Text flex="1" fontSize="sm" truncate>
                {overlayName(o, datasets, connections)}
              </Text>
              <input
                type="color"
                aria-label="Stroke color"
                value={o.stroke_color ?? "#8B4513"}
                onChange={(e) => patch(i, { stroke_color: e.target.value })}
                style={{
                  width: "32px",
                  height: "28px",
                  padding: 0,
                  border: "1px solid var(--chakra-colors-brand-border)",
                  borderRadius: "6px",
                  background: "white",
                }}
              />
              <input
                type="number"
                aria-label="Stroke width"
                min={0.5}
                step={0.5}
                value={o.stroke_width ?? 1.5}
                onChange={(e) =>
                  patch(i, { stroke_width: Number(e.target.value) })
                }
                style={numberInputStyle}
              />
              <input
                type="number"
                aria-label="Fill opacity"
                min={0}
                max={1}
                step={0.1}
                value={o.fill_opacity ?? 0}
                onChange={(e) =>
                  patch(i, { fill_opacity: Number(e.target.value) })
                }
                style={numberInputStyle}
              />
              <IconButton
                aria-label="Remove overlay"
                size="xs"
                variant="ghost"
                color="brand.brown"
                _hover={{ bg: "brand.bgSubtle", color: "red.600" }}
                onClick={() => remove(i)}
              >
                <X size={14} weight="bold" />
              </IconButton>
            </Flex>
          );
        })}
      </Flex>
      <Button
        mt={2}
        size="sm"
        variant="outline"
        borderColor="brand.border"
        color="brand.brown"
        _hover={{ bg: "brand.bgSubtle", borderColor: "brand.orange" }}
        onClick={onAddClick}
      >
        <Plus size={14} weight="bold" /> Add overlay
      </Button>
    </Box>
  );
}
