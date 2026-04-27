import { Box, Heading, Text } from "@chakra-ui/react";
import Markdown from "react-markdown";
import type { ProseChapter as ProseChapterType } from "../lib/story";

interface ProseChapterProps {
  chapter: ProseChapterType;
  chapterIndex: number;
}

export function ProseChapter({ chapter, chapterIndex }: ProseChapterProps) {
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
      <Box
        fontSize="md"
        color="gray.700"
        lineHeight="1.8"
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
    </Box>
  );
}
