import { useState } from "react";
import { Box, Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { CheckCircle, Copy } from "@phosphor-icons/react";

export interface EmbedSnippetProps {
  viewerOrigin: string;
  configUrl: string;
  width?: string;
  height?: string;
}

export function EmbedSnippet({
  viewerOrigin,
  configUrl,
  width = "100%",
  height = "600",
}: EmbedSnippetProps) {
  const [copied, setCopied] = useState(false);

  const snippet = `<iframe src="${viewerOrigin}/?config=${encodeURIComponent(configUrl)}" width="${width}" height="${height}" frameborder="0" allowfullscreen></iframe>`;

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
          bg="gray.50"
          resize="none"
          aria-label="Embed iframe snippet"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
        <Button size="sm" variant="outline" onClick={handleCopy} flexShrink={0}>
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
