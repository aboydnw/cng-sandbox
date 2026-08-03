import { Flex, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { ChapterType } from "../lib/story";
import { CHAPTER_TYPE_REGISTRY } from "../lib/story/chapterRegistry";

interface ChapterTypePickerProps {
  value: ChapterType;
  onChange: (type: ChapterType) => void;
}

export function ChapterTypePicker({ value, onChange }: ChapterTypePickerProps) {
  const current = CHAPTER_TYPE_REGISTRY.find((item) => item.type === value);
  const [showMore, setShowMore] = useState(current?.prominence === "secondary");
  const options = CHAPTER_TYPE_REGISTRY.filter(
    (item) => showMore || item.prominence === "primary"
  );

  return (
    <Flex gap={1} flexWrap="wrap" role="group" aria-label="Chapter type">
      {options.map(({ type, icon: Icon, label, description }) => (
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
          aria-pressed={value === type}
          aria-label={`${label}: ${description}`}
          _hover={{
            bg: value === type ? "brand.bgSubtle" : "brand.bgSubtle",
            color: value === type ? "brand.orange" : "brand.brown",
          }}
          _active={{ transform: "scale(0.98)" }}
          title={description}
          transition="all 0.15s"
        >
          <Icon size={16} />
          <Text fontSize="12px" lineHeight={1}>
            {label}
          </Text>
        </Flex>
      ))}
      <Flex
        as="button"
        align="center"
        px={3}
        py={1.5}
        borderRadius="6px"
        color="gray.600"
        fontWeight={500}
        onClick={() => setShowMore((visible) => !visible)}
        _hover={{ bg: "brand.bgSubtle", color: "brand.brown" }}
      >
        <Text fontSize="12px" lineHeight={1}>
          {showMore ? "Fewer chapter types" : "More chapter types"}
        </Text>
      </Flex>
    </Flex>
  );
}
