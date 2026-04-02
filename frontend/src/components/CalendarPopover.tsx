import { useState, useMemo, useEffect, useRef } from "react";
import { Box, Flex, IconButton, Text } from "@chakra-ui/react";
import { CaretLeft, CaretRight, CalendarBlank } from "@phosphor-icons/react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { Timestep } from "../types";
import type { Cadence } from "../utils/temporal";
import {
  formatTimestepLabel,
  isSubDaily,
  groupTimestepsByDate,
} from "../utils/temporal";

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface CalendarPopoverProps {
  timesteps: Timestep[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  cadence: Cadence;
}

export function CalendarPopover({
  timesteps,
  activeIndex,
  onIndexChange,
  cadence,
}: CalendarPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const currentTimestep = timesteps[activeIndex];
  const currentDate = new Date(currentTimestep.datetime);
  const label = formatTimestepLabel(currentTimestep.datetime, cadence);

  const subDaily = useMemo(
    () => isSubDaily(timesteps.map((ts) => ts.datetime)),
    [timesteps]
  );

  const dateGroups = useMemo(() => {
    if (!subDaily) return null;
    const groups = new Map<string, Timestep[]>();
    for (const ts of timesteps) {
      const key = localDateKey(new Date(ts.datetime));
      const group = groups.get(key) ?? [];
      group.push(ts);
      groups.set(key, group);
    }
    return groups;
  }, [timesteps, subDaily]);

  const dateToIndex = useMemo(() => {
    const map = new Map<string, number>();
    timesteps.forEach((ts, i) => {
      const d = new Date(ts.datetime);
      if (!map.has(localDateKey(d))) map.set(localDateKey(d), i);
    });
    return map;
  }, [timesteps]);

  const startMonth = new Date(timesteps[0].datetime);
  const endMonth = new Date(timesteps[timesteps.length - 1].datetime);

  function handleDayClick(day: Date) {
    const key = localDateKey(day);

    if (subDaily && dateGroups) {
      const times = dateGroups.get(key);
      if (times && times.length > 1) {
        setSelectedDateKey(key);
        return;
      }
    }

    const index = dateToIndex.get(key);
    if (index !== undefined) {
      onIndexChange(index);
      setIsOpen(false);
      setSelectedDateKey(null);
    }
  }

  function handleTimeSelect(timestepIndex: number) {
    onIndexChange(timestepIndex);
    setIsOpen(false);
    setSelectedDateKey(null);
  }

  function handlePrev() {
    if (activeIndex > 0) onIndexChange(activeIndex - 1);
  }

  function handleNext() {
    if (activeIndex < timesteps.length - 1) onIndexChange(activeIndex + 1);
  }

  const timesForSelectedDate =
    selectedDateKey && dateGroups ? dateGroups.get(selectedDateKey) ?? [] : [];

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSelectedDateKey(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <Box position="relative" ref={popoverRef}>
      <Flex align="center" gap={1}>
        <IconButton
          aria-label="Previous timestep"
          size="xs"
          variant="ghost"
          onClick={handlePrev}
          disabled={activeIndex === 0}
        >
          <CaretLeft />
        </IconButton>

        <IconButton
          aria-label="Open calendar"
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsOpen(!isOpen);
            setSelectedDateKey(null);
          }}
        >
          <CalendarBlank />
        </IconButton>

        <Text fontSize="sm" fontWeight="medium" minW="120px" textAlign="center">
          {label}
        </Text>

        <IconButton
          aria-label="Next timestep"
          size="xs"
          variant="ghost"
          onClick={handleNext}
          disabled={activeIndex === timesteps.length - 1}
        >
          <CaretRight />
        </IconButton>
      </Flex>

      {isOpen && (
        <Box
          position="absolute"
          top="100%"
          left="50%"
          transform="translateX(-50%)"
          mt={2}
          bg="white"
          borderRadius="lg"
          boxShadow="lg"
          border="1px solid"
          borderColor="brand.border"
          zIndex={1000}
          p={2}
          sx={{
            ".rdp-day_selected": {
              bg: "brand.orange",
              color: "white",
            },
            ".rdp-day:not(.rdp-day_disabled):hover": {
              bg: "brand.bgSubtle",
            },
          }}
        >
          <DayPicker
            mode="single"
            selected={currentDate}
            onDayClick={(day) => handleDayClick(day)}
            disabled={(date) => !dateToIndex.has(localDateKey(date))}
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={currentDate}
          />

          {selectedDateKey && timesForSelectedDate.length > 0 && (
            <Box
              borderTop="1px solid"
              borderColor="brand.border"
              mt={2}
              pt={2}
            >
              <Text
                fontSize="xs"
                fontWeight="semibold"
                color="fg.subtle"
                mb={1}
              >
                Select time
              </Text>
              <Flex direction="column" gap={1} maxH="150px" overflowY="auto">
                {timesForSelectedDate.map((ts) => {
                  const d = new Date(ts.datetime);
                  const timeLabel = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
                  return (
                    <Box
                      key={ts.index}
                      as="button"
                      px={3}
                      py={1}
                      borderRadius="md"
                      fontSize="sm"
                      textAlign="left"
                      bg={
                        ts.index === activeIndex ? "brand.orange" : "transparent"
                      }
                      color={ts.index === activeIndex ? "white" : "inherit"}
                      _hover={{
                        bg:
                          ts.index === activeIndex
                            ? "brand.orange"
                            : "brand.bgSubtle",
                      }}
                      onClick={() => handleTimeSelect(ts.index)}
                    >
                      {timeLabel}
                    </Box>
                  );
                })}
              </Flex>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
