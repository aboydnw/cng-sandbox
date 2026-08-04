import { Flex, Image } from "@chakra-ui/react";
import { Article, Database, MapTrifold, Path } from "@phosphor-icons/react";

interface ResourceThumbnailProps {
  src?: string | null;
  alt: string;
  kind?: "story" | "raster" | "vector" | "pointcloud" | "trajectory";
}

export function ResourceThumbnail({
  src,
  alt,
  kind = "story",
}: ResourceThumbnailProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={alt}
        w="44px"
        h="44px"
        objectFit="cover"
        borderRadius="md"
        flexShrink={0}
      />
    );
  }

  const Icon =
    kind === "trajectory"
      ? Path
      : kind === "story"
        ? Article
        : kind === "raster" || kind === "vector"
          ? MapTrifold
          : Database;
  return (
    <Flex
      aria-label={`${alt} preview unavailable`}
      w="44px"
      h="44px"
      align="center"
      justify="center"
      bg="bg.emphasized"
      color="action.primary"
      borderRadius="md"
      flexShrink={0}
    >
      <Icon size={20} />
    </Flex>
  );
}
