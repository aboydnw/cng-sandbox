import type { ReactNode } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { CaretDown } from "@phosphor-icons/react";

interface AdvancedSettingsDisclosureProps {
  title: string;
  children: ReactNode;
}

export function AdvancedSettingsDisclosure({
  title,
  children,
}: AdvancedSettingsDisclosureProps) {
  return (
    <Box
      as="details"
      border="1px solid"
      borderColor="brand.border"
      borderRadius="md"
      bg="white"
      css={{ "&[open] > summary svg": { transform: "rotate(180deg)" } }}
    >
      <Flex
        as="summary"
        align="center"
        justify="space-between"
        px={3}
        py={2}
        cursor="pointer"
        listStyle="none"
        css={{ "&::-webkit-details-marker": { display: "none" } }}
      >
        <Text fontSize="sm" fontWeight={600} color="brand.brown">
          {title}
        </Text>
        <CaretDown size={14} style={{ transition: "transform 0.15s" }} />
      </Flex>
      <Box px={3} pb={3}>
        {children}
      </Box>
    </Box>
  );
}
