import { Box, Flex, Text } from "@chakra-ui/react";
import { ArrowSquareOut } from "@phosphor-icons/react";
import type { ToolCardData } from "./types";

interface ToolCardProps {
  tool: ToolCardData;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Box
      flex={1}
      bg="brand.bgSubtle"
      borderRadius="8px"
      p="14px"
      borderLeft="3px solid"
      borderLeftColor="brand.orange"
    >
      <Flex justify="space-between" align="flex-start">
        <Text fontWeight={700} fontSize="13px" color="brand.brown">
          {tool.name}
        </Text>
        {tool.url && (
          <Text
            asChild
            fontSize="10px"
            color="brand.orange"
            whiteSpace="nowrap"
            _hover={{ textDecoration: "underline" }}
          >
            <a href={tool.url} target="_blank" rel="noopener noreferrer">
              GitHub <ArrowSquareOut size={10} style={{ display: "inline" }} />
            </a>
          </Text>
        )}
      </Flex>
      <Text
        fontSize="11px"
        color="brand.textSecondary"
        lineHeight={1.5}
        mt={1}
        dangerouslySetInnerHTML={{ __html: tool.description }}
      />
    </Box>
  );
}
