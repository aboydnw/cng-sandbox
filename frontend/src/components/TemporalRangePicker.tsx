import { useState } from "react";
import { Box, Flex, Text, Button } from "@chakra-ui/react";
import type { TimeDimInfo } from "../types";

const MAX_TIMESTEPS = 50;

interface TemporalRangePickerProps {
  timeDim: TimeDimInfo;
  onConfirm: (startIndex: number, endIndex: number) => void;
}

function labelFor(timeDim: TimeDimInfo, index: number): string {
  if (timeDim.values) {
    return timeDim.values[index].slice(0, 10);
  }
  return `Timestep ${index + 1}`;
}

export function TemporalRangePicker({
  timeDim,
  onConfirm,
}: TemporalRangePickerProps) {
  const exceedsLimit = timeDim.size > MAX_TIMESTEPS;
  const [mode, setMode] = useState<"all" | "range">(
    exceedsLimit ? "range" : "all"
  );
  const [startIndex, setStartIndex] = useState(0);
  const [endIndex, setEndIndex] = useState(
    Math.min(MAX_TIMESTEPS - 1, timeDim.size - 1)
  );

  const selectedCount =
    mode === "all" ? timeDim.size : endIndex - startIndex + 1;
  const isDisabled = selectedCount < 2 || selectedCount > MAX_TIMESTEPS;

  function handleConfirm() {
    if (mode === "all") {
      onConfirm(0, timeDim.size - 1);
    } else {
      onConfirm(startIndex, endIndex);
    }
  }

  function handleStartChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStart = Number(e.target.value);
    setStartIndex(newStart);
    const maxEnd = Math.min(newStart + MAX_TIMESTEPS - 1, timeDim.size - 1);
    if (endIndex < newStart || endIndex > maxEnd) {
      setEndIndex(maxEnd);
    }
  }

  function handleEndChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setEndIndex(Number(e.target.value));
  }

  const cardBase = {
    p: 4,
    border: "1px solid",
    borderRadius: "8px",
    cursor: "pointer",
    flex: 1,
  };

  return (
    <Box py={10} px={8} maxW="520px" mx="auto">
      <Text
        color="brand.brown"
        fontSize="18px"
        fontWeight={700}
        mb={2}
        textAlign="center"
      >
        Select time range
      </Text>
      <Text
        color="brand.textSecondary"
        fontSize="13px"
        mb={6}
        textAlign="center"
      >
        Choose how many to convert.
      </Text>

      {exceedsLimit && (
        <Text
          color="brand.orange"
          fontSize="13px"
          fontWeight={600}
          mb={4}
          textAlign="center"
        >
          Maximum 50 timesteps. Please select a range.
        </Text>
      )}

      <Flex gap={3} mb={6}>
        <Box
          {...cardBase}
          borderColor={mode === "all" ? "brand.orange" : "brand.border"}
          bg={mode === "all" ? "orange.50" : undefined}
          opacity={exceedsLimit ? 0.4 : 1}
          pointerEvents={exceedsLimit ? "none" : undefined}
          onClick={() => !exceedsLimit && setMode("all")}
        >
          <Text fontWeight={600} color="brand.brown" fontSize="14px">
            All
          </Text>
          <Text fontSize="12px" color="brand.textSecondary" mt={1}>
            {timeDim.size} timesteps
          </Text>
        </Box>

        <Box
          {...cardBase}
          borderColor={mode === "range" ? "brand.orange" : "brand.border"}
          bg={mode === "range" ? "orange.50" : undefined}
          onClick={() => setMode("range")}
        >
          <Text fontWeight={600} color="brand.brown" fontSize="14px">
            Range
          </Text>
          <Text fontSize="12px" color="brand.textSecondary" mt={1}>
            Choose start and end
          </Text>
        </Box>
      </Flex>

      {mode === "range" && (
        <Flex gap={4} mb={6} direction="column">
          <Flex align="center" gap={3}>
            <Text fontSize="13px" color="brand.brown" fontWeight={600} w="40px">
              Start
            </Text>
            <Box
              as="select"
              flex={1}
              p={2}
              border="1px solid"
              borderColor="brand.border"
              borderRadius="6px"
              fontSize="13px"
              color="brand.brown"
              value={startIndex}
              onChange={handleStartChange}
            >
              {Array.from({ length: timeDim.size }, (_, i) => (
                <option key={i} value={i}>
                  {labelFor(timeDim, i)}
                </option>
              ))}
            </Box>
          </Flex>

          <Flex align="center" gap={3}>
            <Text fontSize="13px" color="brand.brown" fontWeight={600} w="40px">
              End
            </Text>
            <Box
              as="select"
              flex={1}
              p={2}
              border="1px solid"
              borderColor="brand.border"
              borderRadius="6px"
              fontSize="13px"
              color="brand.brown"
              value={endIndex}
              onChange={handleEndChange}
            >
              {Array.from(
                { length: Math.min(MAX_TIMESTEPS, timeDim.size - startIndex) },
                (_, i) => {
                  const idx = startIndex + i;
                  return (
                    <option key={idx} value={idx}>
                      {labelFor(timeDim, idx)}
                    </option>
                  );
                }
              )}
            </Box>
          </Flex>
        </Flex>
      )}

      <Button
        w="full"
        bg="brand.orange"
        color="white"
        fontWeight={600}
        fontSize="14px"
        borderRadius="8px"
        disabled={isDisabled}
        onClick={handleConfirm}
        _hover={{ opacity: 0.9 }}
      >
        Convert
      </Button>
    </Box>
  );
}
