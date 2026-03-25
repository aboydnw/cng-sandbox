import { Box, Flex, Text } from "@chakra-ui/react";

const COLORMAP_GRADIENTS: Record<string, string> = {
  viridis: "linear-gradient(90deg, #440154, #31688e, #35b779, #fde725)",
  plasma: "linear-gradient(90deg, #0d0887, #7e03a8, #cc4778, #f89540, #f0f921)",
  inferno: "linear-gradient(90deg, #000004, #420a68, #932667, #dd513a, #fcffa4)",
  magma: "linear-gradient(90deg, #000004, #3b0f70, #8c2981, #de4968, #fcfdbf)",
  cividis: "linear-gradient(90deg, #00224e, #123570, #507aa2, #94a866, #fdea45)",
  terrain: "linear-gradient(90deg, #333399, #00b300, #ffe066, #8b4513, #ffffff)",
  blues: "linear-gradient(90deg, #f7fbff, #6baed6, #08306b)",
  reds: "linear-gradient(90deg, #fff5f0, #fb6a4a, #67000d)",
};

interface ColormapPickerProps {
  value: string;
  onChange: (colormap: string) => void;
}

export function ColormapPicker({ value, onChange }: ColormapPickerProps) {
  return (
    <Flex direction="column" gap={0.5}>
      {Object.entries(COLORMAP_GRADIENTS).map(([name, gradient]) => (
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
          <Box w="60px" h="12px" borderRadius="2px" bg={gradient} flexShrink={0} />
          <Text fontSize="12px" color="gray.700">{name}</Text>
        </Flex>
      ))}
    </Flex>
  );
}
