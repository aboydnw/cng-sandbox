import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
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
      <Flex align="center" gap={6}>
        <Link to="/" style={{ textDecoration: "none" }}>
          <Flex align="center" gap={3}>
            <img src="/logo.svg" alt="Development Seed" width={32} height={32} />
            <Text as="span" color="brand.brown" fontWeight={700} fontSize="15px">
              CNG Sandbox
            </Text>
          </Flex>
        </Link>
        <Link to="/datasets" style={{ textDecoration: "none" }}>
          <Text fontSize="sm" fontWeight={500} color="gray.600" _hover={{ color: "gray.800" }}>
            Datasets
          </Text>
        </Link>
      </Flex>
      {children && <Flex gap={2}>{children}</Flex>}
    </Flex>
  );
}
