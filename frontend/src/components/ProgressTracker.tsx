import { Box, Flex, Text, Spinner } from "@chakra-ui/react";
import type { StageInfo } from "../types";

interface ProgressTrackerProps {
  stages: StageInfo[];
  filename: string;
  fileSize: string;
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
        <Text color="white" fontSize="14px">✓</Text>
      </Flex>
    );
  }

  if (status === "active") {
    return (
      <Flex align="center" justify="center" w={size} h={size} flexShrink={0}>
        <Spinner size="sm" color="brand.orange" />
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
        <Text color="white" fontSize="14px">✕</Text>
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

export function ProgressTracker({ stages, filename, fileSize }: ProgressTrackerProps) {
  return (
    <Flex direction="column" align="center" py={14} px={8}>
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
    </Flex>
  );
}
