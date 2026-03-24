import { useState, useEffect } from "react";
import { Box, Text, Button, VStack } from "@chakra-ui/react";
import type { StacItem } from "../hooks/useCatalog";
import { buildCogTileUrl } from "../hooks/useExternalTiles";

interface ItemPreviewProps {
  item: StacItem;
  onTileUrlChange: (url: string | null) => void;
  onClose: () => void;
  onAddToStory?: () => void;
  showStoryButton?: boolean;
}

const COLORMAPS = ["viridis", "plasma", "inferno", "magma", "terrain", "blues", "reds"];

function findDefaultAsset(item: StacItem): { key: string; href: string } | null {
  const entries = Object.entries(item.assets);
  const visual = entries.find(([k]) => k === "visual" || k === "rendered_preview");
  if (visual) return { key: visual[0], href: visual[1].href };
  const cog = entries.find(
    ([, v]) => v.type?.includes("geotiff") || v.href?.endsWith(".tif"),
  );
  if (cog) return { key: cog[0], href: cog[1].href };
  return entries[0] ? { key: entries[0][0], href: entries[0][1].href } : null;
}

export function ItemPreview({
  item,
  onTileUrlChange,
  onClose,
  onAddToStory,
  showStoryButton,
}: ItemPreviewProps) {
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [colormap, setColormap] = useState("viridis");
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    const def = findDefaultAsset(item);
    if (def) setSelectedAsset(def.key);
  }, [item.id]);

  useEffect(() => {
    const asset = item.assets[selectedAsset];
    if (!asset) {
      onTileUrlChange(null);
      return;
    }
    const url = buildCogTileUrl({
      assetUrl: asset.href,
      colormap,
    });
    onTileUrlChange(url);
  }, [selectedAsset, colormap, item.id]);

  const assetKeys = Object.keys(item.assets);
  const date =
    typeof item.properties.datetime === "string"
      ? item.properties.datetime.slice(0, 10)
      : "—";
  const cloud = item.properties["eo:cloud_cover"];

  return (
    <VStack gap={2} align="stretch" p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Text fontSize="sm" fontWeight="bold">{date}</Text>
        <Button variant="ghost" size="xs" onClick={onClose}>✕</Button>
      </Box>

      <Text fontSize="xs" color="whiteAlpha.600">
        {cloud != null ? `Cloud: ${cloud}%` : ""} · {item.id}
      </Text>

      {assetKeys.length > 1 && (
        <Box>
          <Text fontSize="xs" color="whiteAlpha.600" mb={1}>Asset</Text>
          <select
            value={selectedAsset}
            onChange={(e) => setSelectedAsset(e.target.value)}
            style={{ width: "100%", fontSize: "12px" }}
          >
            {assetKeys.map((k) => (
              <option key={k} value={k}>{item.assets[k].title || k}</option>
            ))}
          </select>
        </Box>
      )}

      <Box>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>Colormap</Text>
        <select
          value={colormap}
          onChange={(e) => setColormap(e.target.value)}
          style={{ width: "100%", fontSize: "12px" }}
        >
          {COLORMAPS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Box>

      <Box>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>
          Opacity: {Math.round(opacity * 100)}%
        </Text>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Box>

      {showStoryButton && (
        <Button size="sm" colorPalette="blue" onClick={onAddToStory}>
          Add to story
        </Button>
      )}
    </VStack>
  );
}
