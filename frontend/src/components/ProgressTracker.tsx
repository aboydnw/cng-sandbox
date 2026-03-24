import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Check, SpinnerGap, X } from "@phosphor-icons/react";
import type { StageInfo } from "../types";

interface ProgressTrackerProps {
  stages: StageInfo[];
  filename: string;
  fileSize: string;
  onRetry?: () => void;
  onReport?: () => void;
  embedded?: boolean;
}

function StageIcon({ status }: { status: StageInfo["status"] }) {
  const size = "28px";

  if (status === "done") {
    return (
      <Flex
        align="center"
        justify="center"
        w={size}
        h={size}
        bg="brand.success"
        borderRadius="full"
        flexShrink={0}
      >
        <Check size={14} weight="bold" color="white" />
      </Flex>
    );
  }

  if (status === "active") {
    return (
      <Flex align="center" justify="center" w={size} h={size} flexShrink={0}>
        <SpinnerGap size={16} color="var(--chakra-colors-brand-orange)" style={{ animation: "spin 1s linear infinite" }} />
      </Flex>
    );
  }

  if (status === "error") {
    return (
      <Flex
        align="center"
        justify="center"
        w={size}
        h={size}
        bg="red.500"
        borderRadius="full"
        flexShrink={0}
      >
        <X size={14} weight="bold" color="white" />
      </Flex>
    );
  }

  return (
    <Box
      w={size}
      h={size}
      border="2px solid"
      borderColor="#ddd"
      borderRadius="full"
      flexShrink={0}
    />
  );
}

export function ProgressTracker({ stages, filename, fileSize, onRetry, onReport, embedded }: ProgressTrackerProps) {
  return (
    <Flex direction="column" align={embedded ? "flex-start" : "center"} py={embedded ? 4 : 14} px={embedded ? 0 : 8}>
      <Text color="brand.brown" fontSize="18px" fontWeight={700} mb={1}>
        Processing {filename}
      </Text>
      <Text color="brand.textSecondary" fontSize="13px" mb={10}>
        {fileSize}
      </Text>

      <Box w="100%" maxW="400px">
        {stages.map((stage, i) => (
          <Flex key={stage.name} align="flex-start" gap={3} mb={i < stages.length - 1 ? 6 : 0} position="relative">
            <StageIcon status={stage.status} />
            <Box pt="3px">
              <Text
                color={
                  stage.status === "active"
                    ? "brand.orange"
                    : stage.status === "error"
                      ? "red.500"
                      : stage.status === "done"
                        ? "brand.brown"
                        : "#bbb"
                }
                fontSize="14px"
                fontWeight={stage.status === "active" || stage.status === "error" ? 700 : 600}
              >
                {stage.name}
              </Text>
              {stage.detail && (
                <Text
                  color={stage.status === "error" ? "red.500" : "brand.textSecondary"}
                  fontSize="12px"
                >
                  {stage.detail}
                </Text>
              )}
            </Box>
            {i < stages.length - 1 && (
              <Box
                position="absolute"
                left="13px"
                top="32px"
                w="2px"
                h="20px"
                bg={stage.status === "done" ? "brand.success" : "#ddd"}
              />
            )}
          </Flex>
        ))}
      </Box>
      {onRetry && stages.some((s) => s.status === "error") && (
        <Flex gap={3} mt={6}>
          <Button
            size="sm"
            bg="brand.orange"
            color="white"
            fontWeight={600}
            borderRadius="4px"
            _hover={{ bg: "brand.orangeHover" }}
            onClick={onRetry}
          >
            Try again
          </Button>
          {onReport && (
            <Button
              size="sm"
              variant="outline"
              borderColor="brand.border"
              color="brand.textSecondary"
              fontWeight={600}
              borderRadius="4px"
              _hover={{ color: "brand.brown" }}
              onClick={onReport}
            >
              Report this issue
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  );
}
