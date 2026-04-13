import { Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";

export function SharedHeader() {
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
      <Link to="/" style={{ textDecoration: "none" }}>
        <Flex align="center" gap={3}>
          <img src="/logo.svg" alt="Development Seed" width={32} height={32} />
          <Text as="span" color="brand.brown" fontWeight={700} fontSize="15px">
            CNG Sandbox
          </Text>
        </Flex>
      </Link>
      <Flex align="center" gap={6}>
        <Link to="/about" style={{ textDecoration: "none" }}>
          <Text
            fontSize="sm"
            fontWeight={500}
            color="gray.600"
            _hover={{ color: "gray.800" }}
          >
            About
          </Text>
        </Link>
        <Link to="/" style={{ textDecoration: "none" }}>
          <Flex
            align="center"
            gap={1.5}
            bg="brand.orange"
            color="white"
            px={4}
            py={1.5}
            borderRadius="4px"
            fontWeight={600}
            fontSize="sm"
            _hover={{ bg: "brand.orangeHover" }}
          >
            Make your own map
            <ArrowRight size={14} weight="bold" />
          </Flex>
        </Link>
      </Flex>
    </Flex>
  );
}
