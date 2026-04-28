import { Box, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import type { VideoChapter } from "../lib/story";
import { buildEmbedUrl } from "../lib/story/video";

interface VideoChapterRendererProps {
  chapter: VideoChapter;
  chapterIndex: number;
}

export function VideoChapterRenderer({
  chapter,
  chapterIndex,
}: VideoChapterRendererProps) {
  const src = chapter.video.video_id
    ? buildEmbedUrl({
        provider: chapter.video.provider,
        video_id: chapter.video.video_id,
      })
    : "";

  return (
    <Box maxW="800px" mx="auto" px={8} py={12}>
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
      {chapter.title && (
        <Heading size="lg" mb={4} color="gray.800">
          {chapter.title}
        </Heading>
      )}
      {src && (
        <Box
          mb={4}
          position="relative"
          width="100%"
          paddingTop="56.25%"
          borderRadius={8}
          overflow="hidden"
          bg="black"
        >
          <iframe
            src={src}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            title={chapter.title || "Video"}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              border: 0,
            }}
          />
        </Box>
      )}
      {chapter.narrative && (
        <Box
          fontSize="md"
          color="gray.700"
          lineHeight="1.8"
          css={{
            "& p": { marginBottom: "1em" },
            "& h1, & h2, & h3": { fontWeight: 600, marginBottom: "0.5em" },
          }}
        >
          <Markdown>{chapter.narrative}</Markdown>
        </Box>
      )}
    </Box>
  );
}
