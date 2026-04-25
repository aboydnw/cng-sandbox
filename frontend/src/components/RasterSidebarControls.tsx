import { useState, useEffect } from "react";
import { Box, Button, Flex, NativeSelect, Text, IconButton } from "@chakra-ui/react";
import { ArrowsLeftRight, ArrowCounterClockwise } from "@phosphor-icons/react";
import { ColormapDropdown } from "./ColormapDropdown";
import { EditableCategoryLegend } from "./EditableCategoryLegend";
import { MarkAsCategoricalCard } from "./MarkAsCategoricalCard";
import { MarkAsContinuousLink } from "./MarkAsContinuousLink";

interface BandInfo {
  name: string;
  index: number;
}

interface RasterSidebarControlsProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  colormapName: string;
  onColormapChange: (colormap: string) => void;
  showColormap: boolean;
  bands?: BandInfo[];
  hasRgb?: boolean;
  selectedBand: "rgb" | number;
  onBandChange: (band: "rgb" | number) => void;
  showBands: boolean;
  canClientRender?: boolean;
  clientRenderDisabledReason?: string | null;
  renderMode?: "server" | "client";
  onRenderModeChange?: (mode: "server" | "client") => void;
  isCategorical?: boolean;
  categories?: { value: number; color: string; label: string }[] | null;
  datasetId?: string;
  source?: "dataset" | "connection";
  canMarkCategorical?: boolean;
  canMarkContinuous?: boolean;
  onDatasetUpdated?: () => void;
  onCategoriesChange?: (
    categories: { value: number; color: string; label: string }[]
  ) => void;
  onCategoricalOverride?: (isCategorical: boolean | null) => void;
  rescaleMin: number | null;
  rescaleMax: number | null;
  datasetMin: number | null;
  datasetMax: number | null;
  onRescaleChange: (min: number | null, max: number | null) => void;
  colormapReversed: boolean;
  onColormapReversedChange: (reversed: boolean) => void;
  shared?: boolean;
  savePreferredColormap?: {
    currentSavedColormap: string | null;
    currentSavedReversed: boolean | null;
    onSave: () => Promise<void>;
    saving: boolean;
  };
}

function parseOrNull(s: string): number | null {
  if (s.trim() === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function RasterSidebarControls(props: RasterSidebarControlsProps) {
  const {
    opacity,
    onOpacityChange,
    colormapName,
    onColormapChange,
    showColormap,
    bands,
    hasRgb,
    selectedBand,
    onBandChange,
    showBands,
    canClientRender,
    clientRenderDisabledReason,
    renderMode,
    onRenderModeChange,
    isCategorical,
    categories,
    datasetId,
    source,
    canMarkCategorical,
    canMarkContinuous,
    onDatasetUpdated,
    onCategoriesChange,
    onCategoricalOverride,
    rescaleMin,
    rescaleMax,
    datasetMin,
    datasetMax,
    onRescaleChange,
    colormapReversed,
    onColormapReversedChange,
    shared = false,
    savePreferredColormap,
  } = props;

  const [minDraft, setMinDraft] = useState<string>(
    rescaleMin != null ? String(rescaleMin) : ""
  );
  const [maxDraft, setMaxDraft] = useState<string>(
    rescaleMax != null ? String(rescaleMax) : ""
  );

  useEffect(() => {
    setMinDraft(rescaleMin != null ? String(rescaleMin) : "");
  }, [rescaleMin]);

  useEffect(() => {
    setMaxDraft(rescaleMax != null ? String(rescaleMax) : "");
  }, [rescaleMax]);

  const commit = (nextMin: string, nextMax: string) => {
    const nm = parseOrNull(nextMin);
    const xm = parseOrNull(nextMax);
    if (nm !== rescaleMin || xm !== rescaleMax) {
      onRescaleChange(nm, xm);
    }
  };

  return (
    <Box>
      <Text
        fontSize="11px"
        color="brand.textSecondary"
        fontWeight={600}
        textTransform="uppercase"
        letterSpacing="1px"
        mb={3}
      >
        Visualization Controls
      </Text>

      {isCategorical && datasetId && !shared && (
        <>
          {categories && categories.length > 0 && (
            <EditableCategoryLegend
              datasetId={datasetId}
              source={source}
              categories={categories}
              onCategoriesChange={onCategoriesChange ?? (() => {})}
            />
          )}
          {canMarkContinuous && onDatasetUpdated && (
            <MarkAsContinuousLink
              datasetId={datasetId}
              onSuccess={onDatasetUpdated}
            />
          )}
        </>
      )}

      {!isCategorical && (
        <>
          {!shared && canMarkCategorical && datasetId && onDatasetUpdated && (
            <MarkAsCategoricalCard
              datasetId={datasetId}
              onSuccess={onDatasetUpdated}
            />
          )}

          {showBands && bands && bands.length > 0 && (
            <Box mb={3}>
              <Text fontSize="11px" color="brand.textSecondary" mb={1}>
                Band
              </Text>
              <NativeSelect.Root size="sm">
                <NativeSelect.Field
                  value={String(selectedBand)}
                  onChange={(e) => {
                    const val = e.target.value;
                    onBandChange(val === "rgb" ? "rgb" : Number(val));
                  }}
                  bg="white"
                  border="1px solid"
                  borderColor="brand.border"
                  borderRadius="6px"
                  px={3}
                  py={1}
                  fontSize="13px"
                  _hover={{ borderColor: "brand.orange" }}
                >
                  {hasRgb && <option value="rgb">RGB</option>}
                  {bands.map((b) => (
                    <option key={b.index} value={b.index}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect.Field>
              </NativeSelect.Root>
            </Box>
          )}

          {showColormap && (
            <Box mb={3}>
              <Text fontSize="11px" color="brand.textSecondary" mb={1}>
                Colormap
              </Text>
              <Flex gap={2} align="center">
                <Box flex="1">
                  <ColormapDropdown
                    value={colormapName}
                    onChange={onColormapChange}
                  />
                </Box>
                <IconButton
                  aria-label="Flip colormap"
                  size="sm"
                  variant="outline"
                  bg={colormapReversed ? "brand.orange" : "white"}
                  color={colormapReversed ? "white" : "brand.textSecondary"}
                  borderColor="brand.border"
                  _hover={{ borderColor: "brand.orange" }}
                  onClick={() => onColormapReversedChange(!colormapReversed)}
                >
                  <ArrowsLeftRight size={14} weight="bold" />
                </IconButton>
              </Flex>
              {!shared && savePreferredColormap && (() => {
                const matchesSaved =
                  savePreferredColormap.currentSavedColormap === colormapName &&
                  (savePreferredColormap.currentSavedReversed ?? false) ===
                    colormapReversed;
                const label = matchesSaved ? "Saved" : "Save as default";
                return (
                  <Button
                    type="button"
                    variant="plain"
                    size="xs"
                    h="auto"
                    minW={0}
                    p={0}
                    mt="4px"
                    fontSize="10px"
                    fontWeight={400}
                    color={matchesSaved ? "brand.textSecondary" : "brand.orange"}
                    bg="transparent"
                    cursor={matchesSaved ? "default" : "pointer"}
                    _hover={{
                      color: matchesSaved ? "brand.textSecondary" : "brand.brown",
                    }}
                    aria-label={label}
                    disabled={matchesSaved || savePreferredColormap.saving}
                    onClick={() => void savePreferredColormap.onSave()}
                  >
                    {savePreferredColormap.saving ? "Saving…" : label}
                  </Button>
                );
              })()}
            </Box>
          )}

          {showColormap && (
            <Box mb={3}>
              <Text fontSize="11px" color="brand.textSecondary" mb={1}>
                Rescale
              </Text>
              <Flex gap={2} align="flex-end">
                <Box flex={1} minW={0}>
                  <Text fontSize="10px" color="brand.textSecondary" mb={1}>
                    Min
                  </Text>
                  <input
                    aria-label="Rescale min"
                    type="number"
                    step="any"
                    value={minDraft}
                    placeholder={datasetMin != null ? String(datasetMin) : ""}
                    onChange={(e) => setMinDraft(e.target.value)}
                    onBlur={() => commit(minDraft, maxDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(minDraft, maxDraft);
                    }}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: "28px",
                      padding: "0 8px",
                      border: "1px solid var(--chakra-colors-brand-border)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      background: "white",
                    }}
                  />
                </Box>
                <Box flex={1} minW={0}>
                  <Text fontSize="10px" color="brand.textSecondary" mb={1}>
                    Max
                  </Text>
                  <input
                    aria-label="Rescale max"
                    type="number"
                    step="any"
                    value={maxDraft}
                    placeholder={datasetMax != null ? String(datasetMax) : ""}
                    onChange={(e) => setMaxDraft(e.target.value)}
                    onBlur={() => commit(minDraft, maxDraft)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(minDraft, maxDraft);
                    }}
                    style={{
                      width: "100%",
                      minWidth: 0,
                      height: "28px",
                      padding: "0 8px",
                      border: "1px solid var(--chakra-colors-brand-border)",
                      borderRadius: "6px",
                      fontSize: "13px",
                      background: "white",
                    }}
                  />
                </Box>
                <IconButton
                  aria-label="Reset rescale"
                  size="sm"
                  variant="outline"
                  bg="white"
                  color="brand.textSecondary"
                  borderColor="brand.border"
                  _hover={{ borderColor: "brand.orange" }}
                  onClick={() => {
                    setMinDraft("");
                    setMaxDraft("");
                    onRescaleChange(null, null);
                  }}
                >
                  <ArrowCounterClockwise size={14} weight="bold" />
                </IconButton>
              </Flex>
            </Box>
          )}
        </>
      )}

      {!isCategorical && onCategoricalOverride && (
        <Text
          fontSize="10px"
          color="brand.textSecondary"
          cursor="pointer"
          _hover={{ color: "brand.orange" }}
          onClick={() => onCategoricalOverride(true)}
          mb={3}
        >
          Show as categorical →
        </Text>
      )}

      <Box mb={3} pt={3} borderTop="1px solid" borderColor="brand.border">
        <Flex justify="space-between" mb={1}>
          <Text fontSize="11px" color="brand.textSecondary">
            Opacity
          </Text>
          <Text fontSize="11px" color="brand.textSecondary">
            {Math.round(opacity * 100)}%
          </Text>
        </Flex>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Box>

      {!shared && canClientRender && onRenderModeChange && (
        <Box mb={3} pt={3} borderTop="1px solid" borderColor="brand.border">
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontSize="11px" color="brand.textSecondary">
                Client-side rendering
              </Text>
              <Text fontSize="10px" color="brand.textSecondary">
                Reads COG directly in browser
              </Text>
            </Box>
            <Box
              as="button"
              w="40px"
              h="22px"
              borderRadius="full"
              bg={renderMode === "client" ? "brand.orange" : "brand.border"}
              position="relative"
              cursor="pointer"
              onClick={() =>
                onRenderModeChange(
                  renderMode === "client" ? "server" : "client"
                )
              }
            >
              <Box
                position="absolute"
                top="2px"
                left={renderMode === "client" ? "20px" : "2px"}
                w="18px"
                h="18px"
                borderRadius="full"
                bg="white"
                transition="left 0.15s"
              />
            </Box>
          </Flex>
        </Box>
      )}
      {!shared && canClientRender === false && clientRenderDisabledReason && (
        <Box mb={3}>
          <Text fontSize="11px" color="brand.textSecondary">
            Client-side rendering unavailable
          </Text>
          <Text fontSize="10px" color="brand.textSecondary">
            {clientRenderDisabledReason}
          </Text>
        </Box>
      )}
    </Box>
  );
}
