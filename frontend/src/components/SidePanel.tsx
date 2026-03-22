import { useState, type ReactNode } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import type { Dataset } from "../types";
import { ConversionSummaryCard } from "./ConversionSummaryCard";
import { StoryCTABanner } from "./StoryCTABanner";
import { InlineUpload } from "./InlineUpload";
import { daysUntilExpiry } from "../utils/format";

interface SidePanelProps {
  dataset: Dataset;
  bytesTransferred: number | null;
  onDetailsClick: () => void;
  /** Contextual controls for the bottom section — raster or vector */
  children?: ReactNode;
}

export function SidePanel({ dataset, bytesTransferred, onDetailsClick, children }: SidePanelProps) {
  const [mode, setMode] = useState<"dataset" | "upload">("dataset");
  const expiryDays = daysUntilExpiry(dataset.created_at);

  if (mode === "upload") {
    return (
      <Box h="100%" p={4} overflowY="auto">
        <InlineUpload onCancel={() => setMode("dataset")} />
      </Box>
    );
  }

  return (
    <Flex direction="column" h="100%">
      {/* Pinned top */}
      <Box p={4} flexShrink={0}>
        <ConversionSummaryCard
          dataset={dataset}
          bytesTransferred={bytesTransferred}
          onDetailsClick={onDetailsClick}
        />

        <Box mt={4}>
          <StoryCTABanner dataset={dataset} />
        </Box>

        <Flex
          as="button"
          mt={4}
          w="100%"
          align="center"
          justify="center"
          gap={2}
          py={2}
          bg="brand.bgSubtle"
          border="1px dashed"
          borderColor="brand.border"
          borderRadius="6px"
          color="brand.brown"
          fontSize="13px"
          fontWeight={500}
          cursor="pointer"
          transition="all 200ms ease-out"
          _hover={{ borderColor: "brand.orange", color: "brand.orange", bg: "white" }}
          onClick={() => setMode("upload")}
        >
          <Box as="svg" width="14px" height="14px" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="7" y1="2" x2="7" y2="12" />
            <line x1="2" y1="7" x2="12" y2="7" />
          </Box>
          New upload
        </Flex>

        {expiryDays !== null && (
          <Text fontSize="11px" color="brand.textSecondary" mt={3} textAlign="center">
            Expires in {expiryDays} day{expiryDays !== 1 ? "s" : ""}
          </Text>
        )}
      </Box>

      {/* Contextual bottom — scrollable */}
      {children && (
        <Box flex={1} overflowY="auto" p={4} borderTopWidth="1px" borderColor="brand.border">
          {children}
        </Box>
      )}
    </Flex>
  );
}
