import { Flex, Text } from "@chakra-ui/react";

export function SharedHeader() {
  return (
    <Flex
      as="header"
      align="center"
      px={6}
      py={3}
      bg="white"
      borderBottom="1px solid"
      borderColor="brand.border"
    >
      <Flex align="center" gap={3}>
        <img src="/logo.svg" alt="Development Seed" width={32} height={32} />
        <Text as="span" color="brand.brown" fontWeight={700} fontSize="15px">
          CNG Sandbox
        </Text>
      </Flex>
    </Flex>
  );
}
