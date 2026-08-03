import { useState } from "react";
import { Box, Button, Flex, Text, Textarea } from "@chakra-ui/react";
import { CheckCircle, Copy } from "@phosphor-icons/react";
import type { EmbedTheme } from "../lib/story/embedTheme";
import { embedThemeToParams } from "../lib/story/embedTheme";

export interface EmbedSnippetProps {
  viewerOrigin: string;
  storyId: string;
  storyTitle: string;
  configUrl: string;
  theme?: EmbedTheme;
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
  storyTitle,
  configUrl,
  theme,
}: EmbedSnippetProps) {
  const [copied, setCopied] = useState(false);

  const query = new URLSearchParams({ config: configUrl });
  for (const [key, value] of embedThemeToParams(theme ?? {})) {
    query.set(key, value);
  }
  const src = `${viewerOrigin}/story/${storyId}/embed?${query.toString()}`;
  const safeTitle = storyTitle.replace(/"/g, "&quot;");
  // height:100vh makes the iframe the story's scrollport, which the sticky
  // chapter map requires; the height attribute is the fallback when a CMS
  // strips inline styles.
  const snippet = `<iframe src="${src}" style="width:100%;height:100vh;min-height:500px;border:0" height="700" title="${safeTitle}" loading="lazy" allowfullscreen></iframe>`;

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
        Paste this into your site to embed the story. On WordPress, use a
        full-width (alignfull) Custom HTML block — an Editor or Admin role is
        required, since WordPress strips iframes for lower roles.
      </Text>
    </Box>
  );
}
