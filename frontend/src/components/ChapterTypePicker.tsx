import { Flex, Text } from "@chakra-ui/react";
import { Path, Article, MapTrifold, VideoCamera } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import type { ChapterType } from "../lib/story";
import {
  CHAPTER_TYPE_LABELS,
  CHAPTER_TYPE_DESCRIPTIONS,
} from "../lib/story/labels";

interface ChapterTypeOption {
  type: ChapterType;
  icon: ReactNode;
}

const CHAPTER_TYPE_OPTIONS: ChapterTypeOption[] = [
  { type: "scrollytelling", icon: <Path size={16} /> },
  { type: "map", icon: <MapTrifold size={16} /> },
  { type: "prose", icon: <Article size={16} /> },
  { type: "video", icon: <VideoCamera size={16} /> },
];

interface ChapterTypePickerProps {
  value: ChapterType;
  onChange: (type: ChapterType) => void;
}

export function ChapterTypePicker({ value, onChange }: ChapterTypePickerProps) {
  return (
    <Flex gap={1} flexWrap="wrap">
      {CHAPTER_TYPE_OPTIONS.map(({ type, icon }) => (
        <Flex
          key={type}
          as="button"
          align="center"
          gap={1.5}
          px={3}
          py={1.5}
          borderRadius="6px"
          cursor="pointer"
          bg={value === type ? "brand.bgSubtle" : "transparent"}
          color={value === type ? "brand.orange" : "brand.brown"}
          fontWeight={value === type ? 600 : 500}
          onClick={() => onChange(type)}
          _hover={{
            bg: value === type ? "brand.bgSubtle" : "brand.bgSubtle",
            color: value === type ? "brand.orange" : "brand.brown",
          }}
          _active={{ transform: "scale(0.98)" }}
          title={CHAPTER_TYPE_DESCRIPTIONS[type]}
          transition="all 0.15s"
        >
          {icon}
          <Text fontSize="12px" lineHeight={1}>
            {CHAPTER_TYPE_LABELS[type]}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

export type { ChapterTypeOption };
export { CHAPTER_TYPE_OPTIONS };
