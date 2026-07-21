import { Box, Flex, Skeleton } from "@chakra-ui/react";

export function CollectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Box aria-label="Loading content" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <Flex
          key={index}
          align="center"
          justify="space-between"
          gap={6}
          minH="52px"
          py={3}
          borderBottom="1px solid"
          borderColor="border"
        >
          <Skeleton height="12px" width={index % 2 === 0 ? "42%" : "34%"} />
          <Flex align="center" gap={5} flexShrink={0}>
            <Skeleton height="10px" width="54px" />
            <Skeleton height="10px" width="72px" />
          </Flex>
        </Flex>
      ))}
    </Box>
  );
}
