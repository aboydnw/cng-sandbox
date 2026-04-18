import { useEffect, useRef, useState } from "react";
import { Box, IconButton, Stack, Text } from "@chakra-ui/react";
import { Info } from "@phosphor-icons/react";
import { formatBytes } from "../utils/format";

export interface RenderModeIndicatorProps {
  renderMode: "client" | "server";
  reason: string;
  sizeBytes: number | null;
  forceOpen?: boolean;
}

export function RenderModeIndicator({
  renderMode,
  reason,
  sizeBytes,
  forceOpen = false,
}: RenderModeIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const showDetails = forceOpen || isOpen;

  const modeLabel =
    renderMode === "client" ? "Client (browser)" : "Server tiles";

  useEffect(() => {
    if (!isOpen || forceOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, forceOpen]);

  return (
    <Box
      ref={containerRef}
      position="absolute"
      top="12px"
      right="12px"
      zIndex={10}
      data-snapshot-overlay
    >
      <IconButton
        aria-label="Render mode info"
        title="Render mode info"
        size="sm"
        bg="white"
        color="brand.brown"
        borderWidth="1px"
        borderColor="brand.border"
        borderRadius="4px"
        shadow="sm"
        _hover={{ bg: "brand.bgSubtle" }}
        onClick={() => setIsOpen((v) => !v)}
      >
        <Info size={16} weight="regular" />
      </IconButton>

      {showDetails && (
        <Box
          position="absolute"
          top="calc(100% + 6px)"
          right="0"
          minW="220px"
          bg="white"
          border="1px solid"
          borderColor="brand.border"
          borderRadius="8px"
          boxShadow="md"
          p={3}
          role="dialog"
          aria-label="Render mode details"
        >
          <Stack gap="1">
            <Text fontSize="sm" fontWeight="semibold" color="brand.brown">
              Render mode: {modeLabel}
            </Text>
            {sizeBytes != null && (
              <Text fontSize="sm" color="brand.textSecondary">
                File size: {formatBytes(sizeBytes)}
              </Text>
            )}
            <Text fontSize="sm" color="brand.textSecondary">
              {reason}
            </Text>
          </Stack>
        </Box>
      )}
    </Box>
  );
}
