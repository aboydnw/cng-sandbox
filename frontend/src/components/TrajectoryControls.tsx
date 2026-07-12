import { Box, chakra, Flex, IconButton, Text } from "@chakra-ui/react";
import { Play, Pause } from "@phosphor-icons/react";

interface TrajectoryControlsProps {
  currentTime: number;
  tMin: number;
  tMax: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay(): void;
  onSetSpeed(s: number): void;
  onScrub(t: number): void;
}

const SPEEDS = [1, 2, 5, 10];

function formatTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toISOString().replace(".000Z", "Z");
}

export function TrajectoryControls({
  currentTime,
  tMin,
  tMax,
  isPlaying,
  speed,
  onTogglePlay,
  onSetSpeed,
  onScrub,
}: TrajectoryControlsProps) {
  return (
    <Flex
      position="absolute"
      bottom={4}
      left="50%"
      transform="translateX(-50%)"
      align="center"
      gap={3}
      px={4}
      py={2}
      bg="white"
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="lg"
      boxShadow="md"
    >
      <IconButton
        aria-label={isPlaying ? "Pause" : "Play"}
        size="sm"
        bg="brand.orange"
        color="white"
        _hover={{ bg: "brand.brown" }}
        onClick={onTogglePlay}
      >
        {isPlaying ? (
          <Pause size={16} weight="fill" />
        ) : (
          <Play size={16} weight="fill" />
        )}
      </IconButton>

      <input
        type="range"
        aria-label="Scrub time"
        min={tMin}
        max={tMax}
        value={currentTime}
        onChange={(e) => onScrub(Number(e.target.value))}
      />

      <Text fontSize="xs" fontFamily="mono" color="brand.brown" minW="150px">
        {formatTimestamp(currentTime)}
      </Text>

      <Flex gap={1}>
        {SPEEDS.map((s) => (
          <chakra.button
            key={s}
            type="button"
            aria-pressed={s === speed}
            px={2}
            fontSize="xs"
            borderRadius="sm"
            bg={s === speed ? "brand.orange" : "brand.bgSubtle"}
            color={s === speed ? "white" : "brand.brown"}
            onClick={() => onSetSpeed(s)}
          >
            {s}×
          </chakra.button>
        ))}
      </Flex>

      <Flex align="center" gap={1} aria-label="Speed legend">
        <Text fontSize="10px" color="brand.brown">
          slow
        </Text>
        <Box
          w="60px"
          h="8px"
          borderRadius="full"
          style={{
            background:
              "linear-gradient(to right, rgb(43,131,186), rgb(215,25,28))",
          }}
        />
        <Text fontSize="10px" color="brand.brown">
          fast
        </Text>
      </Flex>
    </Flex>
  );
}
