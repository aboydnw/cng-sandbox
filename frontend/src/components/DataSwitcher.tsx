import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import { connectionsApi, workspaceFetch } from "../lib/api";
import type { Dataset } from "../types";
import { DataSelector } from "./DataSelector";
import type { DataSelectorItem } from "./DataSelector";

interface DataSwitcherProps {
  activeId: string;
  activeSource: "dataset" | "connection";
  onUploadClick: () => void;
  onAddConnectionClick: () => void;
  refreshKey: number;
}

export function DataSwitcher({
  activeId,
  activeSource,
  onUploadClick,
  onAddConnectionClick,
  refreshKey,
}: DataSwitcherProps) {
  const [items, setItems] = useState<DataSelectorItem[]>([]);
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();

  useEffect(() => {
    const fetchData = async () => {
      const datasetItems: DataSelectorItem[] = [];
      const connectionItems: DataSelectorItem[] = [];

      try {
        const res = await workspaceFetch("/api/datasets");
        const list: Dataset[] = await res.json();
        datasetItems.push(
          ...list.map((d) => ({
            id: d.id,
            name: d.filename,
            source: "dataset" as const,
            dataType: d.dataset_type,
            isZeroCopy: d.is_zero_copy,
            isMosaic: d.is_mosaic,
            expiresAt: d.expires_at,
          }))
        );
      } catch {
        // ignore fetch errors
      }

      try {
        const list = await connectionsApi.list();
        connectionItems.push(
          ...list.map((c) => ({
            id: c.id,
            name: c.name,
            source: "connection" as const,
            dataType:
              c.connection_type === "xyz_vector" ||
              (c.connection_type === "pmtiles" && c.tile_type === "vector")
                ? ("vector" as const)
                : ("raster" as const),
          }))
        );
      } catch {
        // ignore fetch errors
      }

      setItems([...datasetItems, ...connectionItems]);
    };

    fetchData();
  }, [refreshKey]);

  const handleSelect = useCallback(
    (id: string, source: "dataset" | "connection") => {
      const path =
        source === "connection"
          ? workspacePath(`/map/connection/${id}`)
          : workspacePath(`/map/${id}`);
      navigate(path);
    },
    [navigate, workspacePath]
  );

  return (
    <DataSelector
      items={items}
      activeId={activeId}
      activeSource={activeSource}
      onSelect={handleSelect}
      onUploadClick={onUploadClick}
      onAddConnectionClick={onAddConnectionClick}
    />
  );
}
