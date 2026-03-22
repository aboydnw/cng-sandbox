import { Box, Flex, Text } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { getTechCards } from "../lib/techDescriptions";
import { TechCard } from "./TechCard";

interface ReportCardProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
}

export function getTileUrlPrefix(tileUrl: string): string {
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

// --- Main component ---

export function ReportCard({ dataset, isOpen, onClose }: ReportCardProps) {
  if (!isOpen) return null;

  const techCards = getTechCards(dataset.credits, dataset.format_pair, dataset.tile_url);

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

        {/* Tech cards */}
        <Flex gap={4} mt={6}>
          {techCards.map((tech) => (
            <TechCard key={tech.name} tech={tech} />
          ))}
        </Flex>
      </Box>
    </Box>
  );
}
