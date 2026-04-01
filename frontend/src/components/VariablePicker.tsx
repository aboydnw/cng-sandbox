import { Box, Flex, Text } from "@chakra-ui/react";
import type { ScannedVariable } from "../types";

interface VariablePickerProps {
  variables: ScannedVariable[];
  onSelect: (variable: string, group: string) => void;
}

export function VariablePicker({ variables, onSelect }: VariablePickerProps) {
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
            onClick={() => onSelect(v.name, v.group)}
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
              <Text fontSize="12px" color="brand.orange" fontWeight={600} mt={1}>
                {v.time_dim.size} timesteps
                {v.time_dim.values &&
                  ` · ${v.time_dim.values[0].slice(0, 10)} to ${v.time_dim.values[v.time_dim.values.length - 1].slice(0, 10)}`}
              </Text>
            )}
          </Box>
        ))}
      </Flex>
    </Box>
  );
}
