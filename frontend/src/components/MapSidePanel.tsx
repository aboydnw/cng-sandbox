import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box } from "@chakra-ui/react";
import { useOptionalWorkspace } from "../hooks/useWorkspace";
import type { MapItem, Connection } from "../types";
import type { RenderMode } from "../hooks/useMapControls";
import { DataSwitcher } from "./DataSwitcher";
import { RasterSidebarControls } from "./RasterSidebarControls";
import { VectorSidebarControls } from "./VectorSidebarControls";
import { ExploreTab } from "./ExploreTab";
import { InlineUpload } from "./InlineUpload";
import { InlineConnectionForm } from "./InlineConnectionForm";
import { ConversionSummaryCard } from "./ConversionSummaryCard";
import { ConnectionInfoCard } from "./ConnectionInfoCard";
import { StoryCTABanner } from "./StoryCTABanner";
import type { Table } from "apache-arrow";

type PanelMode = "controls" | "upload" | "add-connection";

interface BandInfo {
  name: string;
  index: number;
}

interface MapSidePanelProps {
  item: MapItem | null;
  // Control state
  opacity: number;
  onOpacityChange: (v: number) => void;
  colormapName: string;
  onColormapChange: (v: string) => void;
  selectedBand: "rgb" | number;
  onBandChange: (v: "rgb" | number) => void;
  renderMode: RenderMode;
  onRenderModeChange: (v: RenderMode) => void;
  // Derived
  showingColormap: boolean;
  selectableBands: BandInfo[];
  hasRgb: boolean;
  showBands: boolean;
  canClientRender: boolean;
  clientRenderDisabledReason: string | null;
  // Dataset metadata
  bytesTransferred: number | null;
  onDetailsClick: () => void;
  // Vector
  onTableChange: (table: Table | null) => void;
  // Shared view
  shared?: boolean;
}

export function MapSidePanel({
  item,
  opacity,
  onOpacityChange,
  colormapName,
  onColormapChange,
  selectedBand,
  onBandChange,
  renderMode,
  onRenderModeChange,
  showingColormap,
  selectableBands,
  hasRgb,
  showBands,
  canClientRender,
  clientRenderDisabledReason,
  bytesTransferred,
  onDetailsClick,
  onTableChange,
  shared = false,
}: MapSidePanelProps) {
  const [mode, setMode] = useState<PanelMode>("controls");
  const [refreshKey, setRefreshKey] = useState(0);
  const navigate = useNavigate();
  const workspace = useOptionalWorkspace();
  const workspacePath = workspace?.workspacePath ?? ((p: string) => p);

  const handleUploadCancel = useCallback(() => setMode("controls"), []);
  const handleConnectionCancel = useCallback(() => setMode("controls"), []);

  const handleConnectionCreated = useCallback(
    (conn: Connection) => {
      setMode("controls");
      setRefreshKey((k) => k + 1);
      navigate(workspacePath(`/map/connection/${conn.id}`));
    },
    [navigate, workspacePath]
  );

  if (!item) return null;

  if (mode === "upload") {
    return (
      <Box p={4}>
        <InlineUpload onCancel={handleUploadCancel} />
      </Box>
    );
  }

  if (mode === "add-connection") {
    return (
      <Box p={4}>
        <InlineConnectionForm
          onCancel={handleConnectionCancel}
          onCreated={handleConnectionCreated}
        />
      </Box>
    );
  }

  const ds = item.dataset;

  return (
    <Box p={4}>
      {!shared && (
        <DataSwitcher
          activeId={item.id}
          activeSource={item.source}
          onUploadClick={() => setMode("upload")}
          onAddConnectionClick={() => setMode("add-connection")}
          refreshKey={refreshKey}
        />
      )}

      {/* Raster controls */}
      {item.dataType === "raster" && (
        <RasterSidebarControls
          opacity={opacity}
          onOpacityChange={onOpacityChange}
          colormapName={colormapName}
          onColormapChange={onColormapChange}
          showColormap={showingColormap}
          bands={selectableBands}
          hasRgb={hasRgb}
          selectedBand={selectedBand}
          onBandChange={onBandChange}
          showBands={showBands}
          canClientRender={canClientRender}
          clientRenderDisabledReason={clientRenderDisabledReason}
          renderMode={
            renderMode === "server" || renderMode === "client"
              ? renderMode
              : "server"
          }
          onRenderModeChange={(m) => onRenderModeChange(m)}
        />
      )}

      {/* Vector controls */}
      {item.dataType === "vector" && (
        <>
          <VectorSidebarControls
            renderMode={
              renderMode === "vector-tiles" || renderMode === "geojson"
                ? renderMode
                : "vector-tiles"
            }
            onRenderModeChange={(m) => onRenderModeChange(m)}
            hasParquet={!!item.parquetUrl}
            opacity={opacity}
            onOpacityChange={onOpacityChange}
          />
          {renderMode === "geojson" && item.parquetUrl && (
            <Box mt={4}>
              <ExploreTab
                parquetUrl={item.parquetUrl}
                onTableChange={onTableChange}
              />
            </Box>
          )}
        </>
      )}

      {/* Dataset conversion metadata */}
      {ds && (
        <Box mt={4}>
          <ConversionSummaryCard
            dataset={ds}
            bytesTransferred={bytesTransferred}
            onDetailsClick={onDetailsClick}
          />
        </Box>
      )}

      {/* Connection metadata */}
      {item.connection && (
        <Box mt={4}>
          <ConnectionInfoCard
            connection={item.connection}
            onDetailsClick={onDetailsClick}
          />
        </Box>
      )}

      {/* Story CTA — available for both datasets and connections */}
      {!shared && (
        <Box mt={4}>
          <StoryCTABanner dataset={ds} connection={item.connection} />
        </Box>
      )}
    </Box>
  );
}
