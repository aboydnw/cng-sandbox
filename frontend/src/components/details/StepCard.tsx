import { Box, Flex, Text, SimpleGrid } from "@chakra-ui/react";
import type { StepContent } from "./types";
import { MetadataTile } from "./MetadataTile";
import { ToolCard } from "./ToolCard";

interface StepCardProps {
  content: StepContent;
  stepNumber: number;
  totalSteps: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  prevLabel: string | null;
  nextLabel: string | null;
}

export function StepCard({
  content,
  stepNumber,
  totalSteps,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: StepCardProps) {
  return (
    <Box
      bg="white"
      border="2px solid"
      borderColor="brand.orange"
      borderRadius="12px"
      p={6}
      position="relative"
    >
      {/* Badge */}
      <Box
        position="absolute"
        top="-10px"
        left="20px"
        bg="brand.orange"
        color="white"
        fontSize="10px"
        fontWeight={600}
        px={3}
        py="2px"
        borderRadius="4px"
        textTransform="uppercase"
        letterSpacing="0.5px"
      >
        {content.badge}
      </Box>

      {/* Row 1: Explanation + Metadata */}
      <Flex gap={8} mt={2}>
        {/* Left: explanation */}
        <Box flex={1}>
          <Text fontSize="15px" fontWeight={700} color="brand.brown" mb={2}>
            {content.title}
          </Text>
          {content.explanation.map((para, i) => (
            <Text
              key={i}
              fontSize="12px"
              color="brand.textSecondary"
              lineHeight={1.7}
              mb={3}
              dangerouslySetInnerHTML={{ __html: para }}
            />
          ))}
          {/* Before/After */}
          {content.beforeAfter && (
            <Flex
              align="center"
              gap={3}
              bg="brand.bgSubtle"
              borderRadius="8px"
              px={4}
              py={3}
              mt={2}
            >
              <Box>
                <Text fontSize="9px" textTransform="uppercase" color="brand.textSecondary">
                  {content.beforeAfter.beforeLabel}
                </Text>
                <Text fontWeight={700} fontSize="14px" color="brand.brown">
                  {content.beforeAfter.beforeValue}
                </Text>
              </Box>
              <Text color="brand.orange" fontWeight={600} fontSize="16px">
                →
              </Text>
              <Box>
                <Text fontSize="9px" textTransform="uppercase" color="brand.textSecondary">
                  {content.beforeAfter.afterLabel}
                </Text>
                <Text fontWeight={700} fontSize="14px" color="brand.brown">
                  {content.beforeAfter.afterValue}
                </Text>
              </Box>
              <Text fontSize="11px" color="brand.textSecondary" ml={2}>
                {content.beforeAfter.note}
              </Text>
            </Flex>
          )}
        </Box>

        {/* Right: metadata grid */}
        <SimpleGrid columns={2} gap="10px" flex={1}>
          {content.metadata.map((tile) => (
            <MetadataTile key={tile.label} tile={tile} />
          ))}
        </SimpleGrid>
      </Flex>

      {/* Row 2: Tools section */}
      <Box mt={5} pt={4} borderTop="1px solid" borderColor="brand.border">
        <Text
          fontSize="10px"
          textTransform="uppercase"
          letterSpacing="1px"
          color="brand.textSecondary"
          fontWeight={600}
          mb="10px"
        >
          {content.toolSectionTitle}
        </Text>
        <Flex gap={3}>
          {content.tools.map((tool) => (
            <ToolCard key={tool.name} tool={tool} />
          ))}
        </Flex>
      </Box>

      {/* Navigation */}
      <Flex justify="space-between" mt={4}>
        {onPrev ? (
          <Text
            fontSize="11px"
            color="brand.orange"
            fontWeight={600}
            cursor="pointer"
            onClick={onPrev}
            _hover={{ textDecoration: "underline" }}
          >
            ← Back: {prevLabel}
          </Text>
        ) : (
          <Text fontSize="11px" color="brand.textSecondary">
            Step {stepNumber} of {totalSteps}
          </Text>
        )}
        {onNext ? (
          <Text
            fontSize="11px"
            color="brand.orange"
            fontWeight={600}
            cursor="pointer"
            onClick={onNext}
            _hover={{ textDecoration: "underline" }}
          >
            Next: {nextLabel} →
          </Text>
        ) : (
          <Text fontSize="11px" color="brand.textSecondary">
            Step {stepNumber} of {totalSteps}
          </Text>
        )}
      </Flex>
    </Box>
  );
}
