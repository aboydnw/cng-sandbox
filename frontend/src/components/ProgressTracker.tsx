import { useState, useEffect, useRef } from "react";
import { BrandSpinner } from "./ui/BrandSpinner";
import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { Check, X } from "@phosphor-icons/react";
import { formatBytes } from "../utils/format";
import type { StageInfo, StageProgress } from "../types";

interface ProgressTrackerProps {
  stages: StageInfo[];
  filename: string;
  fileSize: string;
  onRetry?: () => void;
  onReport?: () => void;
  embedded?: boolean;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatProgressDetail(
  stageName: string,
  progress?: StageProgress,
  elapsed?: number
): string | null {
  const parts: string[] = [];

  if (
    stageName === "Uploading" &&
    progress?.current != null &&
    progress?.total != null
  ) {
    parts.push(
      `${formatBytes(progress.current)} / ${formatBytes(progress.total)}`
    );
  } else if (progress?.current != null && progress?.total != null) {
    parts.push(`${progress.current} of ${progress.total}`);
  } else if (progress?.percent != null) {
    parts.push(`${progress.percent}%`);
  } else if (progress?.detail) {
    parts.push(
      progress.detail.charAt(0).toUpperCase() + progress.detail.slice(1)
    );
  }

  if (elapsed != null && elapsed > 0) {
    parts.push(formatElapsed(elapsed));
  }

  return parts.length > 0 ? parts.join(" \u00b7 ") : null;
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
        bg="status.success.fg"
        borderRadius="full"
        flexShrink={0}
      >
        <Check
          size={14}
          weight="bold"
          color="var(--chakra-colors-action-on-primary)"
        />
      </Flex>
    );
  }

  if (status === "active") {
    return (
      <Flex align="center" justify="center" w={size} h={size} flexShrink={0}>
        <BrandSpinner size={16} />
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
        bg="status.danger.fg"
        borderRadius="full"
        flexShrink={0}
      >
        <X
          size={14}
          weight="bold"
          color="var(--chakra-colors-action-on-primary)"
        />
      </Flex>
    );
  }

  return (
    <Box
      w={size}
      h={size}
      border="2px solid"
      borderColor="border.emphasized"
      borderRadius="full"
      flexShrink={0}
    />
  );
}

export function ProgressTracker({
  stages,
  filename,
  fileSize,
  onRetry,
  onReport,
  embedded,
}: ProgressTrackerProps) {
  const activeStage = stages.find((s) => s.status === "active");
  const activeStageName = activeStage?.name ?? null;
  const [elapsed, setElapsed] = useState(0);
  const stageStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!activeStageName) {
      setElapsed(0);
      return;
    }

    stageStartRef.current = Date.now();
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - stageStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeStageName]);

  return (
    <Flex
      direction="column"
      align={embedded ? "flex-start" : "center"}
      py={embedded ? 4 : 14}
      px={embedded ? 0 : 8}
    >
      <Text srOnly role="status" aria-live="polite">
        {activeStageName
          ? `Processing: ${activeStageName}`
          : "Processing status"}
      </Text>
      <Text color="fg" fontSize="18px" fontWeight={700} mb={1}>
        Processing {filename}
      </Text>
      <Text color="fg.muted" fontSize="13px" mb={10}>
        {fileSize} · You can leave this page and return from Data later.
      </Text>

      <Box w="100%" maxW="400px">
        {stages.map((stage, i) => (
          <Flex
            key={stage.name}
            align="flex-start"
            gap={3}
            mb={i < stages.length - 1 ? 6 : 0}
            position="relative"
          >
            <StageIcon status={stage.status} />
            <Box pt="3px">
              <Text
                color={
                  stage.status === "active"
                    ? "action.primary"
                    : stage.status === "error"
                      ? "status.danger.fg"
                      : stage.status === "done"
                        ? "fg"
                        : "fg.disabled"
                }
                fontSize="14px"
                fontWeight={
                  stage.status === "active" || stage.status === "error"
                    ? 700
                    : 600
                }
              >
                {stage.name}
              </Text>
              {(stage.detail ||
                (stage.status === "active" &&
                  (stage.progress || elapsed > 0))) && (
                <Text
                  color={
                    stage.status === "error" ? "status.danger.fg" : "fg.muted"
                  }
                  fontSize="12px"
                >
                  {stage.status === "error"
                    ? stage.detail
                    : formatProgressDetail(
                        stage.name,
                        stage.progress,
                        stage.status === "active" ? elapsed : undefined
                      ) || stage.detail}
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
                bg={
                  stage.status === "done"
                    ? "status.success.fg"
                    : "border.emphasized"
                }
              />
            )}
          </Flex>
        ))}
      </Box>
      {onRetry && stages.some((s) => s.status === "error") && (
        <Flex gap={3} mt={6}>
          <Button size="sm" onClick={onRetry}>
            Try again
          </Button>
          {onReport && (
            <Button size="sm" variant="outline" onClick={onReport}>
              Report this issue
            </Button>
          )}
        </Flex>
      )}
    </Flex>
  );
}
