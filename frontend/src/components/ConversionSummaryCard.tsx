import { Box, Flex, Text } from "@chakra-ui/react";
import { ArrowRight } from "@phosphor-icons/react";
import type { Dataset } from "../types";
import { formatBytes } from "../utils/format";
import {
  transition,
  cardHover,
  cardActive,
  focusRing,
} from "../lib/interactionStyles";

function formatPct(transferred: number, total: number): string {
  const pct = (transferred / total) * 100;
  if (pct >= 100) return "100%";
  if (pct >= 1) return `${Math.round(pct)}%`;
  if (pct >= 0.1) return `${pct.toFixed(1)}%`;
  return "<0.1%";
}

interface ConversionSummaryCardProps {
  dataset: Dataset;
  bytesTransferred: number | null;
  onDetailsClick: () => void;
}

export function ConversionSummaryCard({
  dataset,
  bytesTransferred,
  onDetailsClick,
}: ConversionSummaryCardProps) {
  const originalSize = dataset.original_file_size;
  const convertedSize = dataset.converted_file_size;
  const pctSmaller =
    originalSize && convertedSize
      ? Math.round((1 - convertedSize / originalSize) * 100)
      : null;

  // Mini pipeline label
  const formatLabel = dataset.format_pair?.split("-to-") ?? [];
  const fromLabel = formatLabel[0] ?? "original";
  const toLabel = formatLabel[1] ?? "converted";

  return (
    <Box
      bg="white"
      borderRadius="8px"
      border="1px solid"
      borderColor="brand.border"
      borderLeftWidth="3px"
      borderLeftColor="brand.orange"
      p={4}
      cursor="pointer"
      onClick={onDetailsClick}
      transition={transition(200)}
      _hover={{ ...cardHover, borderColor: "brand.orange" }}
      _active={cardActive}
      _focusVisible={focusRing}
    >
      <Text
        fontSize="11px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.textSecondary"
        fontWeight={600}
        mb={2}
      >
        Conversion summary
      </Text>

      {/* Mini pipeline as title */}
      <Flex align="center" gap={2} mb={3}>
        <Box bg="brand.bgSubtle" borderRadius="4px" px={2} py={0.5}>
          <Text fontSize="12px" color="brand.textSecondary">
            {fromLabel}
          </Text>
        </Box>
        <Text fontSize="12px" color="brand.textSecondary">
          →
        </Text>
        <Box bg="brand.bgSubtle" borderRadius="4px" px={2} py={0.5}>
          <Text fontSize="12px" color="brand.success" fontWeight={600}>
            {toLabel}
          </Text>
        </Box>
      </Flex>

      {/* Stats */}
      <Flex gap={6} mb={3}>
        <Box>
          <Text fontSize="13px" color="brand.brown" fontWeight={700}>
            {originalSize ? formatBytes(originalSize) : "—"} →{" "}
            {convertedSize ? formatBytes(convertedSize) : "—"}
          </Text>
          {pctSmaller !== null && pctSmaller > 0 && (
            <Text fontSize="11px" color="brand.success">
              {pctSmaller}% smaller
            </Text>
          )}
        </Box>
        {convertedSize != null && convertedSize > 0 && (
          <Box>
            <Text fontSize="13px" color="brand.orange" fontWeight={700}>
              {bytesTransferred != null && bytesTransferred > 0
                ? `${formatBytes(bytesTransferred)} fetched`
                : "0 B fetched"}
            </Text>
            <Text fontSize="11px" color="brand.textSecondary">
              {bytesTransferred != null && bytesTransferred > 0
                ? `${formatPct(bytesTransferred, convertedSize)} of ${formatBytes(convertedSize)}`
                : `of ${formatBytes(convertedSize)} total`}
            </Text>
          </Box>
        )}
      </Flex>

      {/* CTA at bottom */}
      <Flex align="center" gap={1.5}>
        <Text fontSize="12px" color="brand.orange" fontWeight={600}>
          Details
        </Text>
        <ArrowRight
          size={12}
          weight="bold"
          color="var(--chakra-colors-brand-orange)"
        />
      </Flex>
    </Box>
  );
}
