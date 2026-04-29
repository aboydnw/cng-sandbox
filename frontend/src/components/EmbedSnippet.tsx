import { useState } from "react";
import { Box, Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { CheckCircle, Copy } from "@phosphor-icons/react";

export interface EmbedSnippetProps {
  viewerOrigin: string;
  storyId: string;
  configUrl: string;
  width?: string;
  height?: string;
}

// The snippet must point at the /story/:id/embed route, which is the only
// path that actually reads ?config= and renders the portable viewer. The
// root path "/" is the auth-gated upload page on the main domain and would
// silently redirect end users to a login prompt.
//
// Format support note: v1 supports vector-geoparquet, pmtiles, and xyz
// layers. COG layers in portable mode currently fall back to the server-tile
// path (relative /cog/tiles/...) which the viewer subdomain does not proxy,
// so embeds containing COG layers will not render until the exporter emits
// layer bounds (so client-side rendering can engage) or absolute COG tile
// URLs. See cngRcAdapter.ts for the same caveat.
export function EmbedSnippet({
  viewerOrigin,
  storyId,
  configUrl,
  width = "100%",
  height = "600",
}: EmbedSnippetProps) {
  const [copied, setCopied] = useState(false);

  const src = `${viewerOrigin}/story/${storyId}/embed?config=${encodeURIComponent(configUrl)}`;
  const snippet = `<iframe src="${src}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Clipboard API failed; leave state unchanged
    }
  }

  return (
    <Box>
      <Flex gap={2} align="flex-start">
        <Textarea
          value={snippet}
          readOnly
          rows={3}
          size="sm"
          fontSize="xs"
          fontFamily="mono"
          bg="brand.bgSubtle"
          borderColor="brand.border"
          _focusVisible={{ borderColor: "brand.orange" }}
          resize="none"
          aria-label="Embed iframe snippet"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleCopy}
          flexShrink={0}
          borderColor="brand.border"
          color="brand.brown"
          _hover={{ bg: "brand.bgSubtle" }}
        >
          {copied ? (
            <CheckCircle size={14} weight="fill" />
          ) : (
            <Copy size={14} />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </Flex>
      <Text fontSize="xs" color="fg.muted" mt={2}>
        Paste this into your site to embed the story.
      </Text>
    </Box>
  );
}
