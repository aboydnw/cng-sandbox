import type { ReactNode } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import {
  EASE_OUT_EXPO,
  cardHover,
  cardActive,
  focusRing,
  transition,
} from "../lib/interactionStyles";

interface PathCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  onClick: () => void;
  expanded: boolean;
  faded: boolean;
  onCollapse?: () => void;
  children?: ReactNode;
}

// flex is an accepted exception to the transform-only rule — see spec for rationale
const TRANSITION = `flex 300ms ${EASE_OUT_EXPO}, ${transition(300)}`;

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
      }}
      transition={TRANSITION}
      border="2px solid"
      borderColor={expanded ? "brand.orange" : "brand.border"}
      borderRadius="16px"
      overflow="hidden"
      bg="white"
      _hover={!expanded && !faded ? cardHover : undefined}
      _active={!expanded && !faded ? cardActive : undefined}
      _focusVisible={!expanded && !faded ? focusRing : undefined}
      cursor={!expanded && !faded ? "pointer" : undefined}
      onClick={!expanded && !faded ? onClick : undefined}
      tabIndex={!expanded && !faded ? 0 : undefined}
    >
      {expanded ? (
        <Box p={5} overflow="auto" maxH="calc(100vh - 200px)">
          <Flex align="center" gap={2} mb={4}>
            {onCollapse && (
              <Box
                as="button"
                aria-label="Go back"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onCollapse();
                }}
                cursor="pointer"
                fontSize="18px"
                color="brand.textSecondary"
                _hover={{ color: "brand.brown" }}
                p={1}
                display="flex"
                alignItems="center"
              >
                <ArrowLeft size={18} />
              </Box>
            )}
            <Text
              fontSize="16px"
              fontWeight={700}
              color="brand.brown"
              letterSpacing="-0.02em"
            >
              {title}
            </Text>
          </Flex>
          {children}
        </Box>
      ) : faded ? (
        <Flex direction="column" align="center" justify="center" py={8} px={4}>
          <Box mb={2}>{icon}</Box>
          <Text
            fontSize="13px"
            fontWeight={600}
            color="brand.brown"
            textAlign="center"
            letterSpacing="-0.02em"
          >
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
          <Box mb={3}>{icon}</Box>
          <Text
            fontSize="17px"
            fontWeight={700}
            color="brand.brown"
            mb={2}
            letterSpacing="-0.02em"
          >
            {title}
          </Text>
          <Text
            fontSize="13px"
            color="brand.textSecondary"
            mb={6}
            maxW="240px"
            lineHeight={1.5}
          >
            {description}
          </Text>
          <Flex
            align="center"
            gap={1.5}
            color="brand.orange"
            fontSize="14px"
            fontWeight={600}
          >
            {ctaLabel} <ArrowRight size={14} weight="bold" />
          </Flex>
        </Flex>
      )}
    </Box>
  );
}
