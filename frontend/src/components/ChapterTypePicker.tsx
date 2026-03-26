import { Box, Flex, Text } from "@chakra-ui/react";
import { Scroll, Article, MapTrifold } from "@phosphor-icons/react";
import type { ChapterType } from "../lib/story";
import {
  CHAPTER_TYPE_LABELS,
  CHAPTER_TYPE_DESCRIPTIONS,
} from "../lib/story/labels";

const CHAPTER_TYPES: ChapterType[] = ["scrollytelling", "prose", "map"];

const ICONS: Record<ChapterType, React.ReactNode> = {
  scrollytelling: <Scroll size={24} />,
  prose: <Article size={24} />,
  map: <MapTrifold size={24} />,
};

interface ChapterTypePickerProps {
  value: ChapterType;
  onChange: (type: ChapterType) => void;
}

export function ChapterTypePicker({ value, onChange }: ChapterTypePickerProps) {
  return (
    <Flex gap={2} flexWrap="wrap">
      {CHAPTER_TYPES.map((type) => (
        <Box
          key={type}
          minW="120px"
          flex="1 1 0%"
          border="1px solid"
          borderColor={value === type ? "brand.orange" : "gray.200"}
          bg={value === type ? "brand.bgSubtle" : "white"}
          borderRadius="6px"
          p={2}
          cursor="pointer"
          onClick={() => onChange(type)}
          _hover={{ borderColor: value === type ? "brand.orange" : "gray.300" }}
        >
          <Box color={value === type ? "brand.orange" : "gray.400"} mb={1.5}>
            {ICONS[type]}
          </Box>
          <Text
            fontSize="13px"
            fontWeight={600}
            color={value === type ? "brand.brown" : "gray.700"}
          >
            {CHAPTER_TYPE_LABELS[type]}
          </Text>
          <Text fontSize="11px" color="gray.500" lineHeight="1.3">
            {CHAPTER_TYPE_DESCRIPTIONS[type]}
          </Text>
        </Box>
      ))}
    </Flex>
  );
}
