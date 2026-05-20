import { Box, Button, Text } from "@chakra-ui/react";
import { downloadStoryConfig } from "../lib/story/exportConfig";
import { buildAndDownloadBundle } from "../lib/story/buildStaticBundle";
import { EmbedSnippet } from "./EmbedSnippet";
import type { Story } from "../lib/story";

interface ExportSectionProps {
  story: Story;
  onArchival: () => void;
  onInteractive: () => void;
}

export function ExportSection({
  story,
  onArchival,
  onInteractive,
}: ExportSectionProps) {
  return (
    <Box mt={6}>
      <Text
        fontSize="xs"
        fontWeight={600}
        color="gray.500"
        mb={1.5}
        textTransform="uppercase"
        letterSpacing="wider"
      >
        Export
      </Text>
      <Text fontSize="sm" color="fg.muted" mb={3}>
        Download a portable representation of this story.
      </Text>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          void downloadStoryConfig(story.id, story.title).catch((err) => {
            console.error("Failed to download story config", err);
          });
        }}
      >
        Download story config (cng-rc.json)
      </Button>
      <Button
        size="sm"
        variant="outline"
        mt={3}
        onClick={() => {
          void buildAndDownloadBundle(story.id, story.title).catch((err) => {
            console.error("Failed to download static bundle", err);
          });
        }}
      >
        Download static bundle (.zip)
      </Button>
      <Text fontSize="xs" color="fg.muted" mt={1}>
        Self-contained viewer + config. Upload anywhere static files can be
        served.
      </Text>
      <Button size="sm" variant="outline" mt={3} onClick={() => onArchival()}>
        Download archival HTML
      </Button>
      <Text fontSize="xs" color="fg.muted" mt={1}>
        Single self-contained file. Maps and charts inlined as images. Suitable
        for Zenodo and long-term archives.
      </Text>
      <Button
        size="sm"
        variant="outline"
        borderColor="brand.border"
        color="brand.brown"
        _hover={{ bg: "brand.bgSubtle", color: "brand.orange" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "brand.border",
        }}
        mt={3}
        onClick={() => onInteractive()}
      >
        Download interactive bundle (.zip)
      </Button>
      <Text fontSize="xs" color="fg.muted" mt={1}>
        Self-contained interactive viewer. Maps pan/zoom, charts respond. Larger
        than archival HTML; needs no CNG infrastructure to view.
      </Text>
      <Box mt={4}>
        <EmbedSnippet
          viewerOrigin={
            import.meta.env.VITE_VIEWER_ORIGIN ?? window.location.origin
          }
          storyId={story.id}
          configUrl={`${window.location.origin}/api/stories/${story.id}/export/config`}
        />
      </Box>
    </Box>
  );
}
