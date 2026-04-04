import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { CaretLeft, CaretRight, Play, Pause } from "@phosphor-icons/react";
import type { Timestep } from "../types";
import type { Cadence } from "../utils/temporal";
import { CalendarPopover } from "./CalendarPopover";

interface TemporalControlsProps {
  timesteps: Timestep[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  cadence: Cadence;
  onPrev: () => void;
  onNext: () => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  preloadProgress: { current: number; total: number } | null;
  onExportGif: () => void;
  onExportMp4: () => void;
  isExporting: boolean;
}

const SPEEDS = [0.5, 1, 2];

export function TemporalControls({
  timesteps,
  activeIndex,
  onIndexChange,
  cadence,
  onPrev,
  onNext,
  isPlaying,
  onTogglePlay,
  speed,
  onSpeedChange,
  preloadProgress,
  onExportGif,
  onExportMp4,
  isExporting,
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
      <Box
        bg="white"
        borderRadius="10px"
        boxShadow="0 2px 12px rgba(0,0,0,0.12)"
        px={4}
        py={2.5}
        w="480px"
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

        {/* Top row: three groups */}
        <Flex align="center" justify="space-between" gap={2}>
          {/* Left: Calendar date picker */}
          <CalendarPopover
            timesteps={timesteps}
            activeIndex={activeIndex}
            onIndexChange={onIndexChange}
            cadence={cadence}
          />

          {/* Center: Transport controls */}
          <Flex align="center" gap={1}>
            <IconButton
              aria-label="Previous"
              size="xs"
              variant="ghost"
              onClick={onPrev}
              disabled={disabled || activeIndex === 0}
            >
              <CaretLeft />
            </IconButton>

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
              {isPlaying ? (
                <Pause weight="fill" size={14} />
              ) : (
                <Play weight="fill" size={14} />
              )}
            </Box>

            <IconButton
              aria-label="Next"
              size="xs"
              variant="ghost"
              onClick={onNext}
              disabled={disabled || activeIndex === timesteps.length - 1}
            >
              <CaretRight />
            </IconButton>
          </Flex>

          {/* Right: Speed + Export */}
          <Flex align="center" gap={1.5} flexShrink={0}>
            {/* Speed buttons */}
            <Flex gap="1px">
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
        </Flex>

        {/* Bottom row: Slider */}
        <Box mt={2}>
          <input
            type="range"
            aria-label="Select timestep"
            aria-valuetext={`Timestep ${activeIndex + 1} of ${timesteps.length}`}
            min={0}
            max={timesteps.length - 1}
            value={activeIndex}
            onChange={(e) => onIndexChange(Number(e.target.value))}
            disabled={disabled}
            style={{ width: "100%", accentColor: "#CF3F02" }}
          />
        </Box>
      </Box>
    </Box>
  );
}
