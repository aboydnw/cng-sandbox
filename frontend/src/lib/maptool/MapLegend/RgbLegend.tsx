import { Box, HStack, Text } from "@chakra-ui/react";
import type { RgbLegendConfig } from "./types";

export function RgbLegend(_props: { config: RgbLegendConfig }) {
  return (
    <HStack gap={2} align="center">
      <Box
        width="44px"
        height="12px"
        borderRadius="2px"
        backgroundImage="linear-gradient(90deg, #c0392b, #27ae60, #2980b9)"
      />
      <Text fontSize="11px" color="gray.600" _dark={{ color: "gray.400" }}>
        True color (RGB)
      </Text>
    </HStack>
  );
}
