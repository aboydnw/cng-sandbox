import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { Stop } from "@phosphor-icons/react";
import type { Timestep } from "../types";

interface TemporalControlsProps {
  timesteps: Timestep[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  preloadProgress: { current: number; total: number } | null;
  label: string;
  onExportGif: () => void;
  onExportMp4: () => void;
  isExporting: boolean;
  onExitAnimateMode?: () => void;
}

const SPEEDS = [0.5, 1, 2];

export function TemporalControls({
  timesteps,
  activeIndex,
  onIndexChange,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  preloadProgress,
  label,
  onExportGif,
  onExportMp4,
  isExporting,
  onExitAnimateMode,
}: TemporalControlsProps) {
  const isLoading =
    preloadProgress !== null && preloadProgress.current < preloadProgress.total;
  const disabled = isLoading || isExporting;

  return (
    <Box
      position="absolute"
      bottom={4}
      left="50%"
      transform="translateX(-50%)"
      zIndex={10}
    >
      {/* Timestamp pill */}
      <Flex justify="center" mb={2}>
        <Box
          bg="#2d1b10"
          color="white"
          px={3}
          py={1}
          borderRadius="12px"
          fontSize="13px"
          fontWeight={600}
        >
          {label}
        </Box>
      </Flex>

      {/* Controls bar */}
      <Box
        bg="white"
        borderRadius="10px"
        boxShadow="0 2px 12px rgba(0,0,0,0.12)"
        px={4}
        py={2.5}
        w="420px"
        maxW="calc(100vw - 32px)"
      >
        {/* Pre-load progress */}
        {isLoading && (
          <Flex align="center" gap={2} mb={2}>
            <Box
              flex={1}
              h="3px"
              bg="#f0ebe5"
              borderRadius="2px"
              overflow="hidden"
            >
              <Box
                h="100%"
                bg="brand.orange"
                borderRadius="2px"
                w={`${(preloadProgress.current / preloadProgress.total) * 100}%`}
                transition="width 0.3s cubic-bezier(0.32, 0.72, 0, 1)"
              />
            </Box>
            <Text fontSize="11px" color="#888" whiteSpace="nowrap">
              Loading {preloadProgress.current} of {preloadProgress.total}…
            </Text>
          </Flex>
        )}

        {/* Main controls */}
        <Flex align="center" gap={2.5} opacity={disabled ? 0.4 : 1}>
          {/* Play/pause button */}
          <Box
            as="button"
            onClick={onTogglePlay}
            {...({ disabled } as object)}
            bg={disabled ? "#ccc" : "brand.orange"}
            color="white"
            borderRadius="50%"
            w="28px"
            h="28px"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor={disabled ? "not-allowed" : "pointer"}
            flexShrink={0}
            fontSize="12px"
            border="none"
          >
            {isPlaying ? "⏸" : "▶"}
          </Box>

          {/* Exit animate mode button */}
          {onExitAnimateMode && (
            <IconButton
              aria-label="Exit animation"
              size="sm"
              variant="ghost"
              onClick={onExitAnimateMode}
            >
              <Stop />
            </IconButton>
          )}

          {/* Slider */}
          <Box flex={1}>
            <input
              type="range"
              min={0}
              max={timesteps.length - 1}
              value={activeIndex}
              onChange={(e) => onIndexChange(Number(e.target.value))}
              disabled={disabled}
              style={{ width: "100%", accentColor: "#CF3F02" }}
            />
          </Box>

          {/* Speed buttons */}
          <Flex gap="1px" flexShrink={0}>
            {SPEEDS.map((s) => (
              <Box
                key={s}
                as="button"
                onClick={() => onSpeedChange(s)}
                {...({ disabled } as object)}
                border="1px solid"
                borderColor={s === speed ? "brand.orange" : "#e8e3dd"}
                bg={s === speed ? "#fef6f1" : "white"}
                borderRadius="3px"
                px="5px"
                py="2px"
                fontSize="9px"
                color={s === speed ? "brand.orange" : "#888"}
                fontWeight={s === speed ? 600 : 400}
                cursor={disabled ? "not-allowed" : "pointer"}
              >
                {s}×
              </Box>
            ))}
          </Flex>

          {/* Divider */}
          <Box w="1px" h="20px" bg="#e8e3dd" flexShrink={0} />

          {/* Export buttons */}
          <Box
            as="button"
            onClick={onExportGif}
            {...({ disabled } as object)}
            border="1px solid #e8e3dd"
            bg="white"
            borderRadius="4px"
            px={2}
            py={1}
            fontSize="10px"
            color="#2d1b10"
            fontWeight={500}
            cursor={disabled ? "not-allowed" : "pointer"}
            flexShrink={0}
          >
            GIF
          </Box>
          <Box
            as="button"
            onClick={onExportMp4}
            {...({ disabled } as object)}
            border="1px solid #e8e3dd"
            bg="white"
            borderRadius="4px"
            px={2}
            py={1}
            fontSize="10px"
            color="#2d1b10"
            fontWeight={500}
            cursor={disabled ? "not-allowed" : "pointer"}
            flexShrink={0}
          >
            MP4
          </Box>
        </Flex>
      </Box>
    </Box>
  );
}
