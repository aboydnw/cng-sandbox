import type { ReactNode } from "react";
import { Box, Flex, Heading, Text } from "@chakra-ui/react";

interface PageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <Flex
      justify="space-between"
      align={{ base: "flex-start", md: "flex-end" }}
      direction={{ base: "column", md: "row" }}
      gap={5}
      mb={8}
    >
      <Box maxW="64ch">
        <Heading
          fontSize={{ base: "3xl", md: "4xl" }}
          color="fg"
          letterSpacing="-0.025em"
        >
          {title}
        </Heading>
        <Text color="fg.muted" mt={2} lineHeight="1.6">
          {description}
        </Text>
      </Box>
      {actions && (
        <Flex gap={2} wrap="wrap">
          {actions}
        </Flex>
      )}
    </Flex>
  );
}
