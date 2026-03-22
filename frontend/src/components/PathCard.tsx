import type { ReactNode } from "react";
import { Box, Button, Flex, Text } from "@chakra-ui/react";

interface PathCardProps {
  icon: string;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
  expanded: boolean;
  faded: boolean;
  onCollapse?: () => void;
  children?: ReactNode;
}

const TRANSITION = "all 300ms ease-out";

export function PathCard({
  icon,
  title,
  description,
  ctaLabel,
  onClick,
  expanded,
  faded,
  onCollapse,
  children,
}: PathCardProps) {
  return (
    <Box
      style={{
        flex: expanded ? 2.3 : faded ? 0.7 : 1,
        opacity: faded ? 0.5 : 1,
        transition: TRANSITION,
      }}
      border="2px solid"
      borderColor={expanded ? "brand.orange" : "brand.border"}
      borderRadius="16px"
      overflow="hidden"
      bg="white"
    >
      {expanded ? (
        <Box p={6}>
          <Flex align="center" gap={2} mb={4}>
            <Box
              as="button"
              aria-label="Go back"
              onClick={onCollapse}
              cursor="pointer"
              fontSize="18px"
              color="brand.textSecondary"
              _hover={{ color: "brand.brown" }}
              p={1}
            >
              ←
            </Box>
            <Text fontSize="16px" fontWeight={700} color="brand.brown">
              {title}
            </Text>
          </Flex>
          {children}
        </Box>
      ) : faded ? (
        <Flex direction="column" align="center" justify="center" py={8} px={4}>
          <Text fontSize="28px" mb={2}>{icon}</Text>
          <Text fontSize="13px" fontWeight={600} color="brand.brown" textAlign="center">
            {title}
          </Text>
        </Flex>
      ) : (
        <Flex
          direction="column"
          align="center"
          py={10}
          px={6}
          textAlign="center"
        >
          <Text fontSize="36px" mb={3}>{icon}</Text>
          <Text fontSize="17px" fontWeight={700} color="brand.brown" mb={2}>
            {title}
          </Text>
          <Text fontSize="13px" color="brand.textSecondary" mb={6} maxW="240px" lineHeight={1.5}>
            {description}
          </Text>
          <Button
            bg="brand.orange"
            color="white"
            size="sm"
            fontWeight={600}
            borderRadius="6px"
            _hover={{ bg: "brand.orangeHover" }}
            onClick={onClick}
          >
            {ctaLabel}
          </Button>
        </Flex>
      )}
    </Box>
  );
}
