import { Box, Flex, Text } from "@chakra-ui/react";

export interface ExampleStoryCardProps {
  title: string;
  chapterCount: number;
  dataType: string;
  onClick: () => void;
  loading?: boolean;
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
  onClick,
  loading = false,
  compact = false,
}: ExampleStoryCardProps) {
  const subtitle = `${dataType} · ${chapterCount} ${
    chapterCount === 1 ? "chapter" : "chapters"
  }`;
  const handleClick = () => {
    if (loading) return;
    onClick();
  };
  return (
    <Box
      asChild
      bg="white"
      border="1px solid"
      borderColor="brand.border"
      borderRadius="6px"
      overflow="hidden"
      cursor={loading ? "wait" : "pointer"}
      opacity={loading ? 0.7 : 1}
      _hover={loading ? undefined : { borderColor: "brand.orange" }}
      transition="border-color 0.15s, opacity 0.15s"
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        aria-busy={loading || undefined}
        style={{
          padding: 0,
          margin: 0,
          textAlign: "left",
          font: "inherit",
        }}
      >
        <Flex direction="column">
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
                {loading ? "Cloning into your workspace…" : subtitle}
              </Text>
            )}
          </Box>
        </Flex>
      </button>
    </Box>
  );
}
