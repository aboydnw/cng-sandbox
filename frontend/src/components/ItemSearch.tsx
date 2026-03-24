import { useState } from "react";
import { Box, Button, Text, VStack, Input } from "@chakra-ui/react";

interface ItemSearchProps {
  collectionId: string;
  bbox?: number[];
  onSearch: (filters: {
    collections: string[];
    bbox?: number[];
    datetime?: string;
    cloudCover?: number;
  }) => void;
  loading?: boolean;
  onBack: () => void;
}

export function ItemSearch({ collectionId, bbox, onSearch, loading, onBack }: ItemSearchProps) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [cloudCover, setCloudCover] = useState(20);

  const handleSearch = () => {
    const datetime =
      dateFrom && dateTo
        ? `${dateFrom}T00:00:00Z/${dateTo}T23:59:59Z`
        : dateFrom
          ? `${dateFrom}T00:00:00Z/..`
          : dateTo
            ? `../${dateTo}T23:59:59Z`
            : undefined;

    onSearch({
      collections: [collectionId],
      bbox,
      datetime,
      cloudCover,
    });
  };

  return (
    <VStack gap={3} align="stretch">
      <Button variant="ghost" size="xs" onClick={onBack} alignSelf="flex-start">
        ← Collections
      </Button>

      <Text fontSize="sm" fontWeight="bold">
        {collectionId}
      </Text>

      <Box>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>Date range</Text>
        <Box display="flex" gap={2}>
          <Input
            type="date"
            size="xs"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <Input
            type="date"
            size="xs"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </Box>
      </Box>

      <Box>
        <Text fontSize="xs" color="whiteAlpha.600" mb={1}>
          Cloud cover ≤ {cloudCover}%
        </Text>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={cloudCover}
          onChange={(e) => setCloudCover(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </Box>

      <Button size="sm" colorPalette="blue" onClick={handleSearch} loading={loading}>
        Search this area
      </Button>
    </VStack>
  );
}
