import { Box, Flex, Text } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { formatBytes } from "../utils/format";

interface ConversionSummaryCardProps {
  dataset: Dataset;
  bytesTransferred: number | null;
  onDetailsClick: () => void;
}

export function ConversionSummaryCard({ dataset, bytesTransferred, onDetailsClick }: ConversionSummaryCardProps) {
  const originalSize = dataset.original_file_size;
  const convertedSize = dataset.converted_file_size;
  const pctSmaller =
    originalSize && convertedSize ? Math.round((1 - convertedSize / originalSize) * 100) : null;

  // Mini pipeline label
  const formatLabel = dataset.format_pair?.split("-to-") ?? [];
  const fromLabel = formatLabel[0] ?? "original";
  const toLabel = formatLabel[1] ?? "converted";

  return (
    <Box bg="gray.800" borderRadius="md" p={4} cursor="pointer" onClick={onDetailsClick} _hover={{ bg: "gray.750" }}>
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          Conversion summary
        </Text>
        <Text fontSize="xs" color="brand.orange" cursor="pointer">
          Details →
        </Text>
      </Flex>

      {/* Mini pipeline */}
      <Flex align="center" gap={2} mb={3}>
        <Box bg="gray.700" borderRadius="sm" px={2} py={0.5}>
          <Text fontSize="xs" color="gray.300">{fromLabel}</Text>
        </Box>
        <Text fontSize="xs" color="gray.500">→</Text>
        <Box bg="gray.700" borderRadius="sm" px={2} py={0.5}>
          <Text fontSize="xs" color="green.400">{toLabel}</Text>
        </Box>
      </Flex>

      {/* Stats */}
      <Flex gap={6}>
        <Box>
          <Text fontSize="md" color="white" fontWeight="bold">
            {originalSize ? formatBytes(originalSize) : "—"} → {convertedSize ? formatBytes(convertedSize) : "—"}
          </Text>
          {pctSmaller !== null && pctSmaller > 0 && (
            <Text fontSize="xs" color="green.400">{pctSmaller}% smaller</Text>
          )}
        </Box>
        {bytesTransferred !== null && bytesTransferred > 0 && (
          <Box>
            <Text fontSize="md" color="brand.orange" fontWeight="bold">
              {formatBytes(bytesTransferred)} fetched
            </Text>
            <Text fontSize="xs" color="gray.400">
              of {convertedSize ? formatBytes(convertedSize) : "—"} total
            </Text>
          </Box>
        )}
      </Flex>
    </Box>
  );
}
