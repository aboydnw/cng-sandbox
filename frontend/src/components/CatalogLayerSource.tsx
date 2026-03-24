import { useState } from "react";
import { CatalogPanel } from "./CatalogPanel";
import { ItemPreview } from "./ItemPreview";
import type { StacItem } from "../hooks/useCatalog";
import type { ExternalLayerConfig } from "../lib/story";

interface CatalogLayerSourceProps {
  bbox?: number[];
  onLayerConfigChange: (config: ExternalLayerConfig) => void;
}

export function CatalogLayerSource({ bbox, onLayerConfigChange }: CatalogLayerSourceProps) {
  const [selectedItem, setSelectedItem] = useState<StacItem | null>(null);

  const handleItemSelect = (item: StacItem) => {
    setSelectedItem(item);
  };

  const handleAddToStory = () => {
    if (!selectedItem) return;
    const asset = Object.entries(selectedItem.assets).find(
      ([, v]) => v.type?.includes("geotiff") || v.href?.endsWith(".tif"),
    );
    if (!asset) return;

    const date =
      typeof selectedItem.properties.datetime === "string"
        ? selectedItem.properties.datetime.slice(0, 10)
        : "";

    onLayerConfigChange({
      source: "external",
      provider: "earth-search",
      collection_id: String(selectedItem.properties.collection || ""),
      item_id: selectedItem.id,
      asset_url: asset[1].href,
      label: `${selectedItem.properties.collection || "External"} — ${date}`,
      colormap: "viridis",
      opacity: 0.8,
      basemap: "streets",
    });
  };

  if (selectedItem) {
    return (
      <ItemPreview
        item={selectedItem}
        onTileUrlChange={() => {}}
        onClose={() => setSelectedItem(null)}
        onAddToStory={handleAddToStory}
        showStoryButton
      />
    );
  }

  return (
    <CatalogPanel bbox={bbox} onItemSelect={handleItemSelect} />
  );
}
