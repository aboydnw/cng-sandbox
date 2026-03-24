import { Box, Text } from "@chakra-ui/react";
import type { MetadataTileData } from "./types";

interface MetadataTileProps {
  tile: MetadataTileData;
}

export function MetadataTile({ tile }: MetadataTileProps) {
  return (
    <Box
      bg="brand.bgSubtle"
      borderRadius="8px"
      p={3}
      gridColumn={tile.colSpan ? `span ${tile.colSpan}` : undefined}
    >
      <Text
        fontSize="9px"
        textTransform="uppercase"
        color="brand.textSecondary"
        letterSpacing="0.5px"
        mb="2px"
      >
        {tile.label}
      </Text>
      <Text fontWeight={600} fontSize="14px" color="brand.brown">
        {tile.value}
      </Text>
      {tile.subValue && (
        <Text fontSize="10px" color="brand.textSecondary">
          {tile.subValue}
        </Text>
      )}
    </Box>
  );
}
