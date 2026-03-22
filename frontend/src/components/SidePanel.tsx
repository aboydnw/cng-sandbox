import { useState, type ReactNode } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
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

        <Button
          mt={4}
          w="100%"
          size="sm"
          variant="outline"
          color="gray.300"
          borderColor="gray.600"
          onClick={() => setMode("upload")}
        >
          New upload
        </Button>

        {expiryDays !== null && (
          <Text fontSize="xs" color="gray.500" mt={3} textAlign="center">
            ⏳ Expires in {expiryDays} day{expiryDays !== 1 ? "s" : ""}
          </Text>
        )}
      </Box>

      {/* Contextual bottom — scrollable */}
      {children && (
        <Box flex={1} overflowY="auto" p={4} borderTopWidth="1px" borderColor="gray.700">
          {children}
        </Box>
      )}
    </Flex>
  );
}
