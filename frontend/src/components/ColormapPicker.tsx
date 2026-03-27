import { Box, Flex, Text } from "@chakra-ui/react";
import { COLORMAPS, colormapGradient } from "../lib/maptool/colormaps";

interface ColormapPickerProps {
  value: string;
  onChange: (colormap: string) => void;
}

export function ColormapPicker({ value, onChange }: ColormapPickerProps) {
  return (
    <Flex direction="column" gap={0.5}>
      {Object.keys(COLORMAPS).map((name) => (
        <Flex
          key={name}
          align="center"
          gap={2}
          px={2}
          py={1}
          borderRadius="4px"
          cursor="pointer"
          bg={value === name ? "brand.bgSubtle" : "transparent"}
          border="1px solid"
          borderColor={value === name ? "brand.border" : "transparent"}
          onClick={() => onChange(name)}
          _hover={{ bg: value === name ? "brand.bgSubtle" : "gray.50" }}
        >
          <Box
            w="60px"
            h="12px"
            borderRadius="2px"
            bg={colormapGradient(name)}
            flexShrink={0}
          />
          <Text fontSize="12px" color="gray.700">
            {name}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
