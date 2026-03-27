import { Box, Flex, Text } from "@chakra-ui/react";
import { COLORMAPS, colormapLabel, listColormaps } from "../lib/maptool";

function toGradient(colors: string[]): string {
  return `linear-gradient(90deg, ${colors.join(", ")})`;
}

const COLORMAP_NAMES = listColormaps();

interface ColormapPickerProps {
  value: string;
  onChange: (colormap: string) => void;
}

export function ColormapPicker({ value, onChange }: ColormapPickerProps) {
  return (
    <Flex direction="column" gap={0.5}>
      {COLORMAP_NAMES.map((name) => (
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
            bg={toGradient(COLORMAPS[name])}
            flexShrink={0}
          />
          <Text fontSize="12px" color="gray.700">
            {colormapLabel(name)}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
