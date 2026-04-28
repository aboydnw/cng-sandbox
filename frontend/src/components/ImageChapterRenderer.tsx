import { useState } from "react";
import { Box, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import { ImageLightbox } from "./ImageLightbox";
import type { ImageChapter } from "../lib/story";

interface ImageChapterRendererProps {
  chapter: ImageChapter;
  chapterIndex: number;
}

export function ImageChapterRenderer({
  chapter,
  chapterIndex,
}: ImageChapterRendererProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <Box maxW="800px" mx="auto" py={12} px={6}>
      <Text
        fontSize="10px"
        textTransform="uppercase"
        letterSpacing="1px"
        color="brand.orange"
        fontWeight={600}
        mb={2}
      >
        Chapter {chapterIndex + 1}
      </Text>
      <Heading size="lg" mb={4} color="gray.800">
        {chapter.title}
      </Heading>
      <img
        src={chapter.image.url}
        alt={chapter.image.alt_text}
        onClick={() => setLightboxOpen(true)}
        style={{
          width: "100%",
          maxHeight: "500px",
          objectFit: "contain",
          cursor: "zoom-in",
        }}
      />
      {chapter.narrative.trim() && (
        <Box
          mt={6}
          fontSize="sm"
          color="gray.700"
          lineHeight="1.7"
          css={{
            "& p": { marginBottom: "1em" },
            "& h1, & h2, & h3": {
              fontWeight: 600,
              marginBottom: "0.5em",
            },
          }}
        >
          <Markdown>{chapter.narrative}</Markdown>
        </Box>
      )}
      {lightboxOpen && (
        <ImageLightbox
          src={chapter.image.url}
          alt={chapter.image.alt_text}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </Box>
  );
}
