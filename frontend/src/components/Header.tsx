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
        <img src="/logo.svg" alt="Development Seed" width={32} height={32} />
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
