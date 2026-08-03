import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  useWorkspaceConnections,
  useWorkspaceDatasets,
} from "../hooks/useWorkspaceLibrary";
import { displayName } from "../utils/dataset";
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
  const navigate = useNavigate();
  const { workspacePath } = useWorkspace();
  const datasets = useWorkspaceDatasets();
  const connections = useWorkspaceConnections();
  const retryDatasets = datasets.retry;
  const retryConnections = connections.retry;

  useEffect(() => {
    if (refreshKey === 0) return;
    retryDatasets();
    retryConnections();
  }, [refreshKey, retryDatasets, retryConnections]);

  const items = useMemo<DataSelectorItem[]>(
    () => [
      ...datasets.data.map((dataset) => ({
        id: dataset.id,
        name: displayName(dataset),
        source: "dataset" as const,
        dataType: dataset.dataset_type,
        isZeroCopy: dataset.is_zero_copy,
        isMosaic: dataset.is_mosaic,
        expiresAt: dataset.expires_at,
      })),
      ...connections.data.map((connection) => ({
        id: connection.id,
        name: connection.name,
        source: "connection" as const,
        dataType:
          connection.connection_type === "xyz_vector" ||
          (connection.connection_type === "pmtiles" &&
            connection.tile_type === "vector")
            ? ("vector" as const)
            : ("raster" as const),
      })),
    ],
    [datasets.data, connections.data]
  );

  const isInitialLoading =
    items.length === 0 &&
    (datasets.status === "loading" || connections.status === "loading");
  const failures = [datasets.error, connections.error]
    .filter(Boolean)
    .join("; ");

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
      status={isInitialLoading ? "loading" : failures ? "error" : "ready"}
      error={failures || null}
      onRetry={() => {
        retryDatasets();
        retryConnections();
      }}
      onSelect={handleSelect}
      onUploadClick={onUploadClick}
      onAddConnectionClick={onAddConnectionClick}
    />
  );
}
