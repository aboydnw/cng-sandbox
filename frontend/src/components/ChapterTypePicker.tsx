import { Box, Flex, Text } from "@chakra-ui/react";
import type { ChapterType } from "../lib/story";
import { CHAPTER_TYPE_LABELS, CHAPTER_TYPE_DESCRIPTIONS } from "../lib/story/labels";

const TYPES: ChapterType[] = ["scrollytelling", "prose", "map"];

const ICONS: Record<ChapterType, React.ReactNode> = {
  scrollytelling: (
    <svg width="100%" height="32" viewBox="0 0 80 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="30" height="30" rx="2" fill="#e2e8f0" stroke="#cbd5e0" strokeWidth="1"/>
      <rect x="4" y="5" width="18" height="2" rx="1" fill="#a0aec0"/>
      <rect x="4" y="10" width="22" height="1.5" rx="0.75" fill="#cbd5e0"/>
      <rect x="4" y="14" width="20" height="1.5" rx="0.75" fill="#cbd5e0"/>
      <rect x="4" y="18" width="16" height="1.5" rx="0.75" fill="#cbd5e0"/>
      <rect x="35" y="1" width="44" height="30" rx="2" fill="#bee3f8" stroke="#90cdf4" strokeWidth="1"/>
      <path d="M45 20 L53 12 L59 17 L64 10 L72 18" stroke="#4299e1" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <circle cx="53" cy="12" r="1.5" fill="#4299e1"/>
    </svg>
  ),
  prose: (
    <svg width="100%" height="32" viewBox="0 0 80 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="78" height="30" rx="2" fill="#e2e8f0" stroke="#cbd5e0" strokeWidth="1"/>
      <rect x="8" y="6" width="40" height="2.5" rx="1.25" fill="#a0aec0"/>
      <rect x="8" y="13" width="64" height="1.5" rx="0.75" fill="#cbd5e0"/>
      <rect x="8" y="17" width="60" height="1.5" rx="0.75" fill="#cbd5e0"/>
      <rect x="8" y="21" width="56" height="1.5" rx="0.75" fill="#cbd5e0"/>
      <rect x="8" y="25" width="30" height="1.5" rx="0.75" fill="#cbd5e0"/>
    </svg>
  ),
  map: (
    <svg width="100%" height="32" viewBox="0 0 80 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="78" height="24" rx="2" fill="#bee3f8" stroke="#90cdf4" strokeWidth="1"/>
      <path d="M12 18 L24 8 L34 14 L44 6 L60 16 L70 10" stroke="#4299e1" strokeWidth="1.5" fill="none" strokeLinejoin="round"/>
      <circle cx="34" cy="14" r="2" fill="#4299e1"/>
      <circle cx="24" cy="8" r="1.5" fill="#63b3ed"/>
      <rect x="1" y="27" width="78" height="4" rx="1" fill="#e2e8f0" stroke="#cbd5e0" strokeWidth="1"/>
      <rect x="4" y="28.5" width="30" height="1" rx="0.5" fill="#a0aec0"/>
    </svg>
  ),
};

interface ChapterTypePickerProps {
  value: ChapterType;
  onChange: (type: ChapterType) => void;
}

export function ChapterTypePicker({ value, onChange }: ChapterTypePickerProps) {
  return (
    <Flex gap={2}>
      {TYPES.map((type) => (
        <Box
          key={type}
          flex={1}
          border="1px solid"
          borderColor={value === type ? "blue.400" : "gray.200"}
          bg={value === type ? "blue.50" : "white"}
          borderRadius="6px"
          p={2}
          cursor="pointer"
          onClick={() => onChange(type)}
          _hover={{ borderColor: value === type ? "blue.400" : "gray.300" }}
        >
          <Box h="32px" mb={1.5}>
            {ICONS[type]}
          </Box>
          <Text fontSize="12px" fontWeight={600} color={value === type ? "blue.700" : "gray.700"}>
            {CHAPTER_TYPE_LABELS[type]}
          </Text>
          <Text fontSize="10px" color="gray.500" lineHeight="1.3">
            {CHAPTER_TYPE_DESCRIPTIONS[type]}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}
