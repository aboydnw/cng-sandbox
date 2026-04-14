import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Text } from "@chakra-ui/react";
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
  // Categorical
  isCategorical: boolean;
  categories: { value: number; color: string; label: string }[] | null;
  onCategoriesChange: (
    categories: { value: number; color: string; label: string }[]
  ) => void;
  onCategoricalOverride: (v: boolean | null) => void;
  showCategoricalToggle: boolean;
  // Rescale
  rescaleMin: number | null;
  rescaleMax: number | null;
  datasetMin: number | null;
  datasetMax: number | null;
  onRescaleChange: (min: number | null, max: number | null) => void;
  colormapReversed: boolean;
  onColormapReversedChange: (reversed: boolean) => void;
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
  isCategorical,
  categories,
  onCategoriesChange,
  onCategoricalOverride,
  showCategoricalToggle,
  rescaleMin,
  rescaleMax,
  datasetMin,
  datasetMax,
  onRescaleChange,
  colormapReversed,
  onColormapReversedChange,
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
        <Box mb={4} pb={4} borderBottom="1px solid" borderColor="brand.border">
          <Text
            fontSize="11px"
            color="brand.textSecondary"
            fontWeight={600}
            textTransform="uppercase"
            letterSpacing="1px"
            mb={2}
          >
            Dataset
          </Text>
          <DataSwitcher
            activeId={item.id}
            activeSource={item.source}
            onUploadClick={() => setMode("upload")}
            onAddConnectionClick={() => setMode("add-connection")}
            refreshKey={refreshKey}
          />
        </Box>
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
          isCategorical={isCategorical}
          categories={categories}
          datasetId={item.source === "connection" ? item.id : item.dataset?.id}
          source={item.source === "connection" ? "connection" : "dataset"}
          onCategoriesChange={onCategoriesChange}
          onCategoricalOverride={
            showCategoricalToggle ? onCategoricalOverride : undefined
          }
          rescaleMin={rescaleMin}
          rescaleMax={rescaleMax}
          datasetMin={datasetMin}
          datasetMax={datasetMax}
          onRescaleChange={onRescaleChange}
          colormapReversed={colormapReversed}
          onColormapReversedChange={onColormapReversedChange}
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
