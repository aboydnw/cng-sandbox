import { Box, Flex, Text } from "@chakra-ui/react";
import type { CategoricalLegendConfig } from "./types";

interface CategoricalLegendProps {
  config: CategoricalLegendConfig;
}

export function CategoricalLegend({ config }: CategoricalLegendProps) {
  const { categories, shape = "square" } = config;

  return (
    <Box
      as="ul"
      listStyleType="none"
      m={0}
      p={0}
      display="flex"
      flexWrap="wrap"
      gap={2}
      style={{ maxWidth: "320px" }}
    >
      {categories.map((cat) => (
        <Flex
          as="li"
          key={cat.value}
          alignItems="center"
          gap={2}
          fontSize="12px"
          minW="120px"
          flex="1 1 auto"
        >
          <Box
            display="inline-block"
            flexShrink={0}
            w={shape === "line" ? "16px" : "12px"}
            h={shape === "line" ? "2px" : "12px"}
            rounded={
              shape === "circle" ? "full" : shape === "line" ? "full" : "sm"
            }
            style={{ backgroundColor: cat.color }}
            aria-hidden="true"
          />
          <Text as="span" color="gray.800" _dark={{ color: "gray.50" }}>
            {cat.label ?? cat.value}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}
