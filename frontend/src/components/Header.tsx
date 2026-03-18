import { Box, Flex, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface HeaderProps {
  children?: ReactNode;
}

export function Header({ children }: HeaderProps) {
  return (
    <Flex
      as="header"
      align="center"
      justify="space-between"
      px={6}
      py={3}
      bg="white"
      borderBottom="1px solid"
      borderColor="brand.border"
    >
      <Flex align="center" gap={3}>
        <Flex
          align="center"
          justify="center"
          w="32px"
          h="32px"
          bg="brand.orange"
          borderRadius="4px"
        >
          <Text color="white" fontWeight={700} fontSize="16px">
            ds
          </Text>
        </Flex>
        <Box>
          <Text as="span" color="brand.brown" fontWeight={700} fontSize="15px">
            CNG Sandbox
          </Text>
          <Text
            as="span"
            color="brand.textSecondary"
            fontSize="13px"
            ml={2}
            display={{ base: "none", md: "inline" }}
          >
            by Development Seed
          </Text>
        </Box>
      </Flex>
      {children && <Flex gap={2}>{children}</Flex>}
    </Flex>
  );
}
