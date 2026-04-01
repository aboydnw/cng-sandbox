import { useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import type { ScannedVariable } from "../types";
import { TemporalRangePicker } from "./TemporalRangePicker";

interface VariablePickerProps {
  variables: ScannedVariable[];
  onSelect: (
    variable: string,
    group: string,
    temporal?: { start_index: number; end_index: number }
  ) => void;
}

export function VariablePicker({ variables, onSelect }: VariablePickerProps) {
  const [selectedVar, setSelectedVar] = useState<ScannedVariable | null>(null);

  if (
    variables.length === 1 &&
    variables[0].time_dim &&
    variables[0].time_dim.size > 1
  ) {
    const v = variables[0];
    const td = v.time_dim!;
    return (
      <TemporalRangePicker
        timeDim={td}
        onConfirm={(start, end) =>
          onSelect(v.name, v.group, { start_index: start, end_index: end })
        }
      />
    );
  }

  if (selectedVar?.time_dim && selectedVar.time_dim.size > 1) {
    return (
      <Box>
        <Text
          fontSize="13px"
          color="brand.orange"
          cursor="pointer"
          mb={2}
          px={8}
          onClick={() => setSelectedVar(null)}
        >
          &larr; Back to variables
        </Text>
        <TemporalRangePicker
          timeDim={selectedVar.time_dim}
          onConfirm={(start, end) =>
            onSelect(selectedVar.name, selectedVar.group, {
              start_index: start,
              end_index: end,
            })
          }
        />
      </Box>
    );
  }

  return (
    <Box py={10} px={8} maxW="520px" mx="auto">
      <Text
        color="brand.brown"
        fontSize="18px"
        fontWeight={700}
        mb={2}
        textAlign="center"
      >
        Choose a variable
      </Text>
      <Text
        color="brand.textSecondary"
        fontSize="13px"
        mb={6}
        textAlign="center"
      >
        This file contains multiple raster variables. Select one to convert.
      </Text>
      <Flex direction="column" gap={2}>
        {variables.map((v) => (
          <Box
            key={`${v.group}/${v.name}`}
            p={4}
            border="1px solid"
            borderColor="brand.border"
            borderRadius="8px"
            cursor="pointer"
            _hover={{ borderColor: "brand.orange", bg: "orange.50" }}
            onClick={() => {
              if (v.time_dim && v.time_dim.size > 1) {
                setSelectedVar(v);
              } else {
                onSelect(v.name, v.group);
              }
            }}
          >
            <Text fontWeight={600} color="brand.brown" fontSize="14px">
              {v.name}
            </Text>
            {v.group && (
              <Text fontSize="12px" color="brand.textSecondary" mt={1}>
                {v.group}
              </Text>
            )}
            <Text fontSize="12px" color="#999" mt={1}>
              {v.shape.join(" × ")} · {v.dtype}
              {v.is_complex && " (magnitude will be extracted)"}
            </Text>
            {v.time_dim && v.time_dim.size > 1 && (
              <Text
                fontSize="12px"
                color="brand.orange"
                fontWeight={600}
                mt={1}
              >
                {v.time_dim.size} timesteps
                {v.time_dim.values &&
                  v.time_dim.values.length > 0 &&
                  ` · ${v.time_dim.values[0].slice(0, 10)} to ${v.time_dim.values[v.time_dim.values.length - 1].slice(0, 10)}`}
              </Text>
            )}
          </Box>
        ))}
      </Flex>
    </Box>
  );
}
