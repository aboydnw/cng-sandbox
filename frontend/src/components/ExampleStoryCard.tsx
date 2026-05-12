import { Box, Flex, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";

export interface ExampleStoryCardProps {
  title: string;
  chapterCount: number;
  dataType: string;
  href: string;
  compact?: boolean;
}

function gradientForTitle(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  const palettes: Array<[string, string]> = [
    ["#3a6b8c", "#79a8c2"],
    ["#7a4a18", "#d0a878"],
    ["#2c5e3a", "#7fbf90"],
    ["#5b3a8c", "#a079c2"],
    ["#8c3a5e", "#c279a0"],
  ];
  const [from, to] = palettes[hash % palettes.length];
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function ExampleStoryCard({
  title,
  chapterCount,
  dataType,
  href,
  compact = false,
}: ExampleStoryCardProps) {
  const subtitle = `${dataType} · ${chapterCount} ${
    chapterCount === 1 ? "chapter" : "chapters"
  }`;
  return (
    <Link to={href} style={{ textDecoration: "none" }}>
      <Flex
        direction="column"
        border="1px solid"
        borderColor="brand.border"
        borderRadius="6px"
        overflow="hidden"
        bg="white"
        _hover={{ borderColor: "brand.orange" }}
        transition="border-color 0.15s"
      >
        <Box
          h={compact ? "46px" : "90px"}
          style={{ background: gradientForTitle(title) }}
        />
        <Box px={3} py={2}>
          <Text
            fontWeight={600}
            fontSize={compact ? "12px" : "14px"}
            color="brand.brown"
            truncate
            title={title}
          >
            {title}
          </Text>
          {!compact && (
            <Text fontSize="11px" color="gray.500" mt={1}>
              {subtitle}
            </Text>
          )}
        </Box>
      </Flex>
    </Link>
  );
}
