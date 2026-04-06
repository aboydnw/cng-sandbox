import { useState, useMemo, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Box, Flex, Text } from "@chakra-ui/react";
import { CalendarBlank } from "@phosphor-icons/react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import type { Timestep } from "../types";
import type { Cadence } from "../utils/temporal";
import { formatTimestepLabel, isSubDaily } from "../utils/temporal";

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

  const timesForSelectedDate =
    selectedDateKey && dateGroups
      ? (dateGroups.get(selectedDateKey) ?? [])
      : [];

  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const upwardBottom = window.innerHeight - rect.top + 4;
    const wouldGoOffScreenAbove = rect.top - 400 < 0;
    if (wouldGoOffScreenAbove) {
      setPopupStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        zIndex: 1000,
      });
    } else {
      setPopupStyle({
        position: "fixed",
        bottom: upwardBottom,
        left: rect.left,
        zIndex: 1000,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        popupRef.current &&
        !popupRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelectedDateKey(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <Box ref={triggerRef}>
      <Flex
        as="button"
        aria-label="Open calendar"
        align="center"
        gap={1.5}
        cursor="pointer"
        onClick={() => {
          setIsOpen(!isOpen);
          setSelectedDateKey(null);
        }}
        borderRadius="6px"
        px={2}
        py={1}
        _hover={{ bg: "brand.bgSubtle" }}
      >
        <CalendarBlank
          size={16}
          color="var(--chakra-colors-brand-text-secondary)"
        />
        <Text fontSize="13px" fontWeight={600} color="brand.brown">
          {label}
        </Text>
      </Flex>

      {isOpen &&
        createPortal(
          <Box
            ref={popupRef}
            style={popupStyle}
            bg="white"
            borderRadius="lg"
            boxShadow="0 4px 20px rgba(0,0,0,0.15)"
            border="1px solid"
            borderColor="brand.border"
            p={2}
            css={{
              ".rdp-day_selected": {
                backgroundColor: "var(--chakra-colors-brand-orange)",
                color: "white",
              },
              ".rdp-day_disabled": {
                color: "#ccc",
              },
              ".rdp-day:not(.rdp-day_disabled):hover": {
                backgroundColor: "brand.bgSubtle",
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
                  color="brand.textSecondary"
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
                          ts.index === activeIndex
                            ? "brand.orange"
                            : "transparent"
                        }
                        color={
                          ts.index === activeIndex ? "white" : "brand.brown"
                        }
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
          </Box>,
          document.body
        )}
    </Box>
  );
}
