import { Box, Text, VStack, Spinner } from "@chakra-ui/react";

interface Collection {
  id: string;
  title?: string;
  description?: string;
}

interface CollectionListProps {
  collections: Collection[];
  onSelect: (collectionId: string) => void;
  loading?: boolean;
}

export function CollectionList({ collections, onSelect, loading }: CollectionListProps) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <Spinner size="sm" />
      </Box>
    );
  }

  return (
    <VStack gap={1} align="stretch">
      {collections.map((c) => (
        <Box
          key={c.id}
          px={3}
          py={2}
          borderRadius="md"
          cursor="pointer"
          _hover={{ bg: "whiteAlpha.100" }}
          onClick={() => onSelect(c.id)}
        >
          <Text fontSize="sm" fontWeight="medium">
            {c.title || c.id}
          </Text>
          {c.description && (
            <Text fontSize="xs" color="whiteAlpha.600" lineClamp={2}>
              {c.description}
            </Text>
          )}
        </Box>
      ))}
    </VStack>
  );
}
