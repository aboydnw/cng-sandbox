import { Box, Flex, Text } from "@chakra-ui/react";

export interface ExampleStoryCardProps {
  title: string;
  chapterCount: number;
  dataType: string;
  onClick: () => void;
  loading?: boolean;
  compact?: boolean;
  featured?: boolean;
}

function previewForTitle(title: string): string | null {
  const normalized = title.toLowerCase();
  if (normalized.includes("carbon") || normalized.includes("field")) {
    return "/thumbnails/lg-land-carbon.jpg";
  }
  if (normalized.includes("gebco") || normalized.includes("bathymetry")) {
    return "/thumbnails/gebco.jpg";
  }
  if (
    normalized.includes("ghrsst") ||
    normalized.includes("sea surface") ||
    normalized.includes("ocean")
  ) {
    return "/thumbnails/ghrsst.jpg";
  }
  return null;
}

export function ExampleStoryCard({
  title,
  chapterCount,
  dataType,
  onClick,
  loading = false,
  compact = false,
  featured = false,
}: ExampleStoryCardProps) {
  const subtitle = `${dataType} · ${chapterCount} ${
    chapterCount === 1 ? "chapter" : "chapters"
  }`;
  const handleClick = () => {
    if (loading) return;
    onClick();
  };
  const preview = previewForTitle(title);
  return (
    <Box
      asChild
      bg="white"
      border="1px solid"
      borderColor="brand.border"
      borderRadius="panel"
      overflow="hidden"
      cursor={loading ? "wait" : "pointer"}
      opacity={loading ? 0.7 : 1}
      _hover={
        loading
          ? undefined
          : { borderColor: "border.emphasized", transform: "translateY(-2px)" }
      }
      transition="border-color 180ms, opacity 180ms, transform 180ms"
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
            h={
              compact
                ? "72px"
                : featured
                  ? { base: "220px", md: "340px" }
                  : "150px"
            }
            bg={preview ? "bg.emphasized" : "#DDD6CE"}
            backgroundImage={
              preview
                ? `url(${preview})`
                : "linear-gradient(rgba(68,63,63,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(68,63,63,.08) 1px, transparent 1px)"
            }
            backgroundSize={preview ? "cover" : "24px 24px"}
            backgroundPosition="center"
            role="img"
            aria-label={
              preview
                ? `Map preview for ${title}`
                : `Cartographic preview placeholder for ${title}`
            }
          />
          <Box px={featured ? 5 : 4} py={featured ? 4 : 3}>
            <Text
              fontWeight={600}
              fontSize={compact ? "sm" : featured ? "lg" : "md"}
              color="fg"
              truncate
              title={title}
            >
              {title}
            </Text>
            {!compact && (
              <Text fontSize="sm" color="fg.muted" mt={1}>
                {loading ? "Cloning into your workspace…" : subtitle}
              </Text>
            )}
          </Box>
        </Flex>
      </button>
    </Box>
  );
}
