import { Box, Text, VStack, Button } from "@chakra-ui/react";
import type { StacItem } from "../hooks/useCatalog";

interface ItemResultsProps {
  items: StacItem[];
  onSelect: (item: StacItem) => void;
  onHover?: (item: StacItem | null) => void;
  totalMatched?: number | null;
  onLoadMore?: () => void;
  loading?: boolean;
}

function formatDate(dateStr: unknown): string {
  if (typeof dateStr !== "string") return "—";
  return dateStr.slice(0, 10);
}

export function ItemResults({
  items,
  onSelect,
  onHover,
  totalMatched,
  onLoadMore,
  loading,
}: ItemResultsProps) {
  if (items.length === 0 && !loading) {
    return (
      <Text fontSize="sm" color="whiteAlpha.500" py={4} textAlign="center">
        No imagery found. Try widening the date range or panning the map.
      </Text>
    );
  }

  return (
    <VStack gap={1} align="stretch">
      {totalMatched != null && (
        <Text fontSize="xs" color="whiteAlpha.500">
          {totalMatched} results (showing {items.length})
        </Text>
      )}
      {items.map((item) => (
        <Box
          key={item.id}
          px={3}
          py={2}
          borderRadius="md"
          cursor="pointer"
          _hover={{ bg: "whiteAlpha.100" }}
          onClick={() => onSelect(item)}
          onMouseEnter={() => onHover?.(item)}
          onMouseLeave={() => onHover?.(null)}
        >
          <Text fontSize="sm">{formatDate(item.properties.datetime)}</Text>
          <Text fontSize="xs" color="whiteAlpha.600">
            {item.properties["eo:cloud_cover"] != null
              ? `☁ ${item.properties["eo:cloud_cover"]}%`
              : ""}{" "}
            · {item.id}
          </Text>
        </Box>
      ))}
      {onLoadMore && items.length > 0 && items.length < (totalMatched ?? Infinity) && (
        <Button variant="ghost" size="xs" onClick={onLoadMore} loading={loading}>
          Load more
        </Button>
      )}
    </VStack>
  );
}
