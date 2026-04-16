import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { X } from "@phosphor-icons/react";
import type { Dataset } from "../types";
import { displayName } from "../utils/dataset";
import { PipelineTimeline } from "./details/PipelineTimeline";
import { StepCard } from "./details/StepCard";
import { getStepContent, getStepCount } from "./details/stepContent";

interface ReportCardProps {
  dataset: Dataset;
  isOpen: boolean;
  onClose: () => void;
  renderMode?: string;
}

export function getTileUrlPrefix(tileUrl: string): string {
  const parts = tileUrl.split("/");
  return "/" + parts[1] + "/";
}

export function ReportCard({ dataset, isOpen, onClose }: ReportCardProps) {
  const [activeStep, setActiveStep] = useState(1);
  const totalSteps = getStepCount(dataset);

  // Reset to step 1 when drawer opens or dataset changes
  useEffect(() => {
    if (isOpen) setActiveStep(1);
  }, [isOpen, dataset.id]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "ArrowRight" && activeStep < totalSteps)
        setActiveStep((s) => s + 1);
      if (e.key === "ArrowLeft" && activeStep > 1) setActiveStep((s) => s - 1);
      if (e.key === "Escape") onClose();
    },
    [isOpen, activeStep, totalSteps, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const allSteps = useMemo(
    () =>
      Array.from({ length: totalSteps }, (_, i) =>
        getStepContent(dataset, i + 1)
      ),
    [dataset, totalSteps]
  );

  if (!isOpen) return null;

  const stepSummaries = allSteps.map((s) => ({
    label: s.label,
    subtitle: s.subtitle,
  }));
  const currentContent = allSteps[activeStep - 1];
  const prevContent = activeStep > 1 ? allSteps[activeStep - 2] : null;
  const nextContent = activeStep < totalSteps ? allSteps[activeStep] : null;

  return (
    <Box
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex={100}
      bg="brand.bgSubtle"
      borderTop="1px solid"
      borderColor="brand.border"
      maxH="70vh"
      overflowY="auto"
      boxShadow="0 -4px 24px rgba(0,0,0,0.10)"
    >
      <Box maxW="1400px" mx="auto" px={8} py={6}>
        {/* Header */}
        <Flex justify="space-between" align="flex-start" mb={6}>
          <Box>
            <Text
              fontSize="11px"
              textTransform="uppercase"
              letterSpacing="1px"
              color="brand.textSecondary"
              fontWeight={600}
              mb={1}
            >
              Your data, transformed
            </Text>
            <Text fontSize="18px" fontWeight={700} color="brand.brown">
              {displayName(dataset)}
            </Text>
          </Box>
          <Box
            as="button"
            aria-label="Close report card"
            onClick={onClose}
            cursor="pointer"
            p={1}
            display="flex"
            alignItems="center"
            color="brand.textSecondary"
            _hover={{ color: "brand.brown" }}
          >
            <X size={16} />
          </Box>
        </Flex>

        {/* Timeline */}
        <PipelineTimeline
          steps={stepSummaries}
          activeStep={activeStep}
          onStepClick={setActiveStep}
        />

        {/* Step Card */}
        <StepCard
          content={currentContent}
          stepNumber={activeStep}
          totalSteps={totalSteps}
          onPrev={activeStep > 1 ? () => setActiveStep((s) => s - 1) : null}
          onNext={
            activeStep < totalSteps ? () => setActiveStep((s) => s + 1) : null
          }
          prevLabel={prevContent?.label ?? null}
          nextLabel={nextContent?.label ?? null}
        />
      </Box>
    </Box>
  );
}
