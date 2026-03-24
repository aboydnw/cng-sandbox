import { Box, Flex, Text } from "@chakra-ui/react";
import type { StepContent } from "./types";

interface PipelineTimelineProps {
  steps: Pick<StepContent, "label" | "subtitle">[];
  activeStep: number;
  onStepClick: (step: number) => void;
}

export function PipelineTimeline({ steps, activeStep, onStepClick }: PipelineTimelineProps) {
  return (
    <Flex align="flex-start" gap={0} mb={6} px="10px">
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === activeStep;

        return (
          <Box key={stepNum} display="contents">
            {/* Connector line before (skip first) */}
            {i > 0 && (
              <Box
                flex={1}
                h="2px"
                bg={stepNum <= activeStep ? "brand.orange" : "brand.border"}
                mt="17px"
                transition="background 0.3s"
              />
            )}
            {/* Step dot + labels */}
            <Flex
              direction="column"
              align="center"
              minW="80px"
              cursor="pointer"
              onClick={() => onStepClick(stepNum)}
            >
              <Flex
                w="36px"
                h="36px"
                borderRadius="50%"
                bg={isActive ? "brand.orange" : "brand.border"}
                color={isActive ? "white" : "brand.textSecondary"}
                align="center"
                justify="center"
                fontSize="11px"
                fontWeight={700}
                boxShadow={isActive ? "0 0 0 4px rgba(207,63,2,0.15)" : "none"}
                transition="all 0.3s"
              >
                {stepNum}
              </Flex>
              <Text
                fontSize="11px"
                fontWeight={600}
                color={isActive ? "brand.orange" : "brand.brown"}
                mt="6px"
                transition="color 0.3s"
              >
                {step.label}
              </Text>
              <Text
                fontSize="9px"
                color={isActive ? "brand.orange" : "brand.textSecondary"}
                mt="1px"
                transition="color 0.3s"
              >
                {step.subtitle}
              </Text>
            </Flex>
          </Box>
        );
      })}
    </Flex>
  );
}
