import { Box, Flex, Text, Tooltip } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { useTileTransferSize } from "../hooks/useTileTransferSize";

interface ReportCardProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
  onScrollToCredits?: () => void;
}

// --- Formatting helpers ---

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDownloadTime(bytes: number): string {
  const seconds = bytes / 1_500_000;
  if (seconds < 60) return `~${Math.ceil(seconds)} sec`;
  return `~${Math.ceil(seconds / 60)} min`;
}

function formatGeometryLabel(types: string[]): string {
  // types is pre-sorted by frequency (most common first) by the backend
  if (types.length === 0) return "features";
  return types.slice(0, 2).join(" / ") + " features";
}

function getTileUrlPrefix(tileUrl: string): string {
  // "/pmtiles/datasets/..." → "/pmtiles/"
  // "/raster/..." → "/raster/"
  const parts = tileUrl.split("/");
  return "/" + parts[1] + "/";
}

// --- Transformation bar ---

interface TransformStep {
  label: string;
  tools: string;
}

function getTransformationSteps(dataset: Dataset): {
  steps: TransformStep[];
  final: string;
} {
  const isPmtiles = dataset.tile_url?.startsWith("/pmtiles/");
  switch (dataset.format_pair) {
    case "geotiff-to-cog":
      return {
        steps: [{ label: ".tif  GeoTIFF", tools: "rio-cogeo" }],
        final: ".tif  COG",
      };
    case "netcdf-to-cog":
      return {
        steps: [{ label: ".nc  NetCDF", tools: "xarray → rio-cogeo" }],
        final: ".tif  COG",
      };
    case "shapefile-to-geoparquet":
      return isPmtiles
        ? {
            steps: [
              { label: ".shp  Shapefile", tools: "GeoPandas" },
              { label: ".parquet  GeoParquet", tools: "tippecanoe" },
            ],
            final: ".pmtiles  PMTiles",
          }
        : {
            steps: [{ label: ".shp  Shapefile", tools: "GeoPandas → PostGIS" }],
            final: "MVT  tiles via tipg",
          };
    case "geojson-to-geoparquet":
      return isPmtiles
        ? {
            steps: [
              { label: ".geojson  GeoJSON", tools: "GeoPandas" },
              { label: ".parquet  GeoParquet", tools: "tippecanoe" },
            ],
            final: ".pmtiles  PMTiles",
          }
        : {
            steps: [{ label: ".geojson  GeoJSON", tools: "GeoPandas → PostGIS" }],
            final: "MVT  tiles via tipg",
          };
    default:
      return {
        steps: [{ label: dataset.format_pair, tools: "→" }],
        final: "cloud-native",
      };
  }
}

// --- Null-safe display helper ---

// Chakra v3 uses compound Tooltip API (Tooltip.Root / Tooltip.Trigger / Tooltip.Content)
function NullStat({ message = "Not available for datasets converted before this feature launched" }: { message?: string }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <Text as="span" color="brand.textSecondary" fontSize="12px" cursor="default">—</Text>
      </Tooltip.Trigger>
      <Tooltip.Content>{message}</Tooltip.Content>
    </Tooltip.Root>
  );
}

// --- Stat Cards ---

function FileSizeCard({ dataset }: { dataset: Dataset }) {
  const orig = dataset.original_file_size;
  const geo = dataset.geoparquet_file_size;
  const conv = dataset.converted_file_size;
  const pct = orig && conv ? Math.round((1 - conv / orig) * 100) : null;
  const hasFeatures = dataset.feature_count != null && dataset.geometry_types != null;

  return (
    <Box bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4}>
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3}>
        File size
      </Text>
      {orig != null && conv != null ? (
        <>
          <Box mb={2}>
            <Flex justify="space-between" fontSize="11px" color="brand.textSecondary" mb={1}>
              <span>Original</span><span>{formatBytes(orig)}</span>
            </Flex>
            <Box h="6px" bg="brand.bgSubtle" borderRadius="3px">
              <Box h="100%" w="100%" bg="#d4cfc9" borderRadius="3px" />
            </Box>
          </Box>
          {geo != null && (
            <Box mb={2}>
              <Flex justify="space-between" fontSize="11px" color="brand.textSecondary" mb={1} fontStyle="italic">
                <span>.parquet</span><span>{formatBytes(geo)}</span>
              </Flex>
              <Box h="6px" bg="brand.bgSubtle" borderRadius="3px">
                <Box h="100%" w={`${Math.max(1, (geo / orig) * 100)}%`} bg="#b5cdd4" borderRadius="3px" />
              </Box>
            </Box>
          )}
          <Box mb={3}>
            <Flex justify="space-between" fontSize="11px" color="brand.orange" mb={1} fontWeight={600}>
              <span>Converted</span><span>{formatBytes(conv)}</span>
            </Flex>
            <Box h="6px" bg="#fde8d8" borderRadius="3px">
              <Box h="100%" w={`${Math.max(1, (conv / orig) * 100)}%`} bg="brand.orange" borderRadius="3px" />
            </Box>
          </Box>
          {pct !== null && pct > 0 && (
            <Text fontSize="13px" fontWeight={700} color="brand.brown">{pct}% smaller</Text>
          )}
        </>
      ) : (
        <NullStat />
      )}
      {hasFeatures && (
        <Box borderTop="1px solid" borderColor="brand.border" pt={3} mt={3}>
          <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={1}>
            {formatGeometryLabel(dataset.geometry_types!)}
          </Text>
          <Text fontSize="13px" fontWeight={700} color="brand.brown">
            {dataset.feature_count!.toLocaleString()}{" "}
            <Text as="span" color="brand.success" fontWeight={400} fontSize="12px">✓ all preserved</Text>
          </Text>
          <Text fontSize="11px" color="brand.textSecondary" mt={1}>Attributes, geometry, and CRS intact</Text>
        </Box>
      )}
    </Box>
  );
}

function DataFetchedCard({ dataset, tileUrlPrefix }: { dataset: Dataset; tileUrlPrefix: string }) {
  const fetched = useTileTransferSize(tileUrlPrefix);
  const conv = dataset.converted_file_size;
  const isRaster = dataset.dataset_type === "raster";
  // null = no tile requests yet (show 0 B + Live badge, will update as tiles load)
  // 0    = requests made but transferSize is 0 (Timing-Allow-Origin not set)
  // >0   = working correctly
  const displayBytes = fetched ?? 0;
  const unavailable = fetched === 0;  // entries exist but transferSize is 0

  return (
    <Box bg="white" borderRadius="8px" border="2px solid" borderColor="brand.orange" p={4} position="relative">
      {!unavailable && (
        <Box
          position="absolute" top="-10px" left="14px"
          bg="brand.orange" color="white"
          fontSize="10px" fontWeight={700} textTransform="uppercase" letterSpacing="1px"
          px={2} py="2px" borderRadius="10px"
        >
          Live
        </Box>
      )}
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3} mt={1}>
        Data fetched since page load
      </Text>
      {unavailable ? (
        <NullStat message="Byte tracking requires server configuration — contact your admin." />
      ) : (
        <>
          <Text fontSize="28px" fontWeight={700} color="brand.orange" mb={1}>
            {formatBytes(displayBytes)}
          </Text>
          <Text fontSize="12px" color="brand.textSecondary" mb={3}>loaded so far</Text>
          {conv != null && (
            <Box bg="brand.bgSubtle" borderRadius="6px" p={3}>
              <Flex justify="space-between" mb={1}>
                <Text fontSize="11px" color="brand.textSecondary">Full file</Text>
                <Text fontSize="11px" fontWeight={600} color="brand.textSecondary">{formatBytes(conv)}</Text>
              </Flex>
              <Flex justify="space-between" mb={2}>
                <Text fontSize="11px" color="brand.orange" fontWeight={600}>Fetched</Text>
                <Text fontSize="11px" fontWeight={700} color="brand.orange">{formatBytes(displayBytes)}</Text>
              </Flex>
              {displayBytes > 0 && (
                <Text fontSize="13px" fontWeight={700} color="brand.orange">
                  {Math.max(0.1, (displayBytes / conv) * 100).toFixed(1)}% of the file
                </Text>
              )}
            </Box>
          )}
          <Text fontSize="11px" color="brand.textSecondary" mt={3}>
            {isRaster
              ? "Only the tiles you look at are rendered and fetched."
              : "Only the tiles you look at are ever fetched — pan or zoom to see this grow."}
          </Text>
        </>
      )}
    </Box>
  );
}

function ShareCard({ dataset }: { dataset: Dataset }) {
  const orig = dataset.original_file_size;
  return (
    <Box bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4}>
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3}>
        To share this map
      </Text>
      <Box mb={3} pb={3} borderBottom="1px solid" borderColor="brand.border">
        <Text fontSize="11px" color="brand.textSecondary" mb={2}>Before</Text>
        {orig != null ? (
          <Text fontSize="12px" color="brand.textSecondary" lineHeight="1.6">
            Email a {formatBytes(orig)} file.<br />
            <Text as="span" color="red.500" fontWeight={600}>{formatDownloadTime(orig)} to download on 4G (est.)</Text><br />
            Recipient needs ArcGIS or QGIS to open it.
          </Text>
        ) : (
          <NullStat />
        )}
      </Box>
      <Box>
        <Text fontSize="11px" color="brand.orange" fontWeight={600} mb={2}>Now</Text>
        <Text fontSize="12px" color="brand.brown" fontWeight={600} lineHeight="1.6">
          Send a URL.<br />
          <Text as="span" color="brand.success">Opens in any browser.</Text><br />
          No software required.<br />
          No proprietary license.
        </Text>
      </Box>
    </Box>
  );
}

function CapabilitiesCard({ dataset }: { dataset: Dataset }) {
  const isVector = dataset.dataset_type === "vector";
  const items = [
    "Shareable URL — anyone can view",
    "Zoom to any scale, no pixelation",
    isVector ? "Click features to inspect attributes" : "Click pixels to inspect values",
    "Embed in any webpage",
    "No proprietary license or specialized GIS server required",
  ];
  return (
    <Box bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border" p={4}>
      <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={3}>
        Now possible
      </Text>
      <Flex direction="column" gap={2} mb={3}>
        {items.map((item) => (
          <Flex key={item} gap={2} align="flex-start">
            <Text color="brand.success" fontWeight={700} fontSize="12px">✓</Text>
            <Text fontSize="12px" color="brand.brown">{item}</Text>
          </Flex>
        ))}
      </Flex>
      {dataset.min_zoom != null && dataset.max_zoom != null && (
        <Box borderTop="1px solid" borderColor="brand.border" pt={3}>
          <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={1}>
            Zoom range
          </Text>
          <Text fontSize="13px" fontWeight={700} color="brand.brown">
            z{dataset.min_zoom}–z{dataset.max_zoom}{" "}
            <Text as="span" fontWeight={400} color="brand.textSecondary" fontSize="11px">auto-selected</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
}

// --- Main component ---

export function ReportCard({ dataset, isOpen, onClose, onScrollToCredits }: ReportCardProps) {
  const tileUrlPrefix = getTileUrlPrefix(dataset.tile_url);

  if (!isOpen) return null;

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={100}
      bg="brand.bgSubtle"
      borderTop="1px solid"
      borderColor="brand.border"
      maxH="70vh"
      overflowY="auto"
      boxShadow="0 -4px 24px rgba(0,0,0,0.10)"
    >
      <Box maxW="1400px" mx="auto" px={8} py={6}>
        {/* Header */}
        <Flex justify="space-between" align="flex-start" mb={6}>
          <Box>
            <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" fontWeight={600} mb={1}>
              Your data, transformed
            </Text>
            <Text fontSize="18px" fontWeight={700} color="brand.brown">{dataset.filename}</Text>
          </Box>
          <Text
            fontSize="20px" color="brand.textSecondary" cursor="pointer" lineHeight="1"
            onClick={onClose} aria-label="Close report card"
            _hover={{ color: "brand.brown" }}
          >
            ✕
          </Text>
        </Flex>

        {/* Transformation bar */}
        {(() => {
          const { steps, final } = getTransformationSteps(dataset);
          return (
            <Flex align="center" gap={3} mb={6} p={4} bg="white" borderRadius="8px" border="1px solid" borderColor="brand.border">
              {steps.map((step, i) => (
                <Box key={i} display="contents">
                  <Box textAlign="center" minW="110px">
                    <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" mb={1}>
                      {i === 0 ? "Was" : "→"}
                    </Text>
                    <Box bg="brand.bgSubtle" borderRadius="4px" px={3} py={1} display="inline-block">
                      <Text fontSize="12px" fontWeight={700} color="brand.textSecondary">{step.label}</Text>
                    </Box>
                  </Box>
                  <Box flex={1} display="flex" alignItems="center" gap={2}>
                    <Box flex={1} h="2px" bgGradient="to-r" gradientFrom="brand.border" gradientTo="brand.orange" />
                    <Text fontSize="11px" color="brand.orange" fontWeight={600} whiteSpace="nowrap">→ {step.tools} →</Text>
                    <Box flex={1} h="2px" bg="brand.orange" />
                  </Box>
                </Box>
              ))}
              <Box textAlign="center" minW="110px">
                <Text fontSize="11px" textTransform="uppercase" letterSpacing="1px" color="brand.textSecondary" mb={1}>Is now</Text>
                <Box bg="brand.orange" borderRadius="4px" px={3} py={1} display="inline-block">
                  <Text fontSize="12px" fontWeight={700} color="white">{final}</Text>
                </Box>
              </Box>
            </Flex>
          );
        })()}

        {/* Stat cards */}
        <Box
          display="grid"
          gridTemplateColumns={{ base: "1fr", md: "1fr 1fr" }}
          gap={4}
          mb={6}
        >
          <FileSizeCard dataset={dataset} />
          <DataFetchedCard dataset={dataset} tileUrlPrefix={tileUrlPrefix} />
          <ShareCard dataset={dataset} />
          <CapabilitiesCard dataset={dataset} />
        </Box>

        {/* Footer */}
        <Text fontSize="12px" color="brand.textSecondary" textAlign="center">
          Converted using open source tools maintained by Development Seed and the community.{" "}
          <Text as="span" color="brand.orange" cursor="pointer" fontWeight={600}
            onClick={onScrollToCredits}>
            See the full pipeline →
          </Text>
        </Text>
      </Box>
    </Box>
  );
}
