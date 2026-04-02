import { useMemo } from "react";
import { Flex, IconButton } from "@chakra-ui/react";
import { Play } from "@phosphor-icons/react";
import type { Timestep } from "../types";
import { detectCadence } from "../utils/temporal";
import { CalendarPopover } from "./CalendarPopover";

interface TemporalBrowseBarProps {
  timesteps: Timestep[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onEnterAnimateMode: () => void;
}

export function TemporalBrowseBar({
  timesteps,
  activeIndex,
  onIndexChange,
  onEnterAnimateMode,
}: TemporalBrowseBarProps) {
  const cadence = useMemo(
    () => detectCadence(timesteps.map((ts) => ts.datetime)),
    [timesteps]
  );

  return (
    <Flex align="center" gap={2} p={2} bg="bg" borderRadius="md" boxShadow="sm">
      <CalendarPopover
        timesteps={timesteps}
        activeIndex={activeIndex}
        onIndexChange={onIndexChange}
        cadence={cadence}
      />
      <IconButton
        aria-label="Animate"
        size="sm"
        variant="outline"
        onClick={onEnterAnimateMode}
      >
        <Play />
      </IconButton>
    </Flex>
  );
}
