import { useEffect } from "react";
import { Box, Flex, Heading, Input, Text } from "@chakra-ui/react";
import type { EmbedTheme } from "../lib/story/embedTheme";
import { buildGoogleFontsUrl } from "../lib/story/embedTheme";

export const POPULAR_GOOGLE_FONTS = [
  "Archivo",
  "Bricolage Grotesque",
  "Geist",
  "Inter",
  "Lato",
  "Libre Baskerville",
  "Lora",
  "Merriweather",
  "Montserrat",
  "Open Sans",
  "Playfair Display",
  "Work Sans",
];

const PREVIEW_FONTS_LINK_ID = "cng-embed-theme-preview-fonts";

interface EmbedThemeControlsProps {
  value: EmbedTheme;
  onChange: (theme: EmbedTheme) => void;
}

export function EmbedThemeControls({
  value,
  onChange,
}: EmbedThemeControlsProps) {
  const fontsUrl = buildGoogleFontsUrl(
    [value.bodyFont, value.headingFont].filter((f): f is string => Boolean(f))
  );

  useEffect(() => {
    if (!fontsUrl) return;
    let link = document.getElementById(
      PREVIEW_FONTS_LINK_ID
    ) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.id = PREVIEW_FONTS_LINK_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    if (link.href !== fontsUrl) link.href = fontsUrl;
  }, [fontsUrl]);

  function set(field: keyof EmbedTheme, raw: string) {
    const next = { ...value };
    if (raw) {
      next[field] = raw;
    } else {
      delete next[field];
    }
    onChange(next);
  }

  return (
    <Box>
      <Text fontSize="sm" fontWeight={600} color="brand.brown" mb={2}>
        Match your site
      </Text>
      <datalist id="cng-google-fonts">
        {POPULAR_GOOGLE_FONTS.map((font) => (
          <option key={font} value={font} />
        ))}
      </datalist>
      <Flex gap={2} wrap="wrap">
        <Box flex="1" minW="160px">
          <Text asChild fontSize="xs" color="fg.muted">
            <label htmlFor="embed-body-font">Body font</label>
          </Text>
          <Input
            id="embed-body-font"
            size="sm"
            list="cng-google-fonts"
            placeholder="Google Font name"
            value={value.bodyFont ?? ""}
            onChange={(e) => set("bodyFont", e.target.value)}
          />
        </Box>
        <Box flex="1" minW="160px">
          <Text asChild fontSize="xs" color="fg.muted">
            <label htmlFor="embed-heading-font">Heading font</label>
          </Text>
          <Input
            id="embed-heading-font"
            size="sm"
            list="cng-google-fonts"
            placeholder="Google Font name"
            value={value.headingFont ?? ""}
            onChange={(e) => set("headingFont", e.target.value)}
          />
        </Box>
        <Box>
          <Text asChild fontSize="xs" color="fg.muted">
            <label htmlFor="embed-accent">Accent color</label>
          </Text>
          <Input
            id="embed-accent"
            type="color"
            size="sm"
            w="48px"
            p={0.5}
            value={value.accent ?? "#CF3F02"}
            onChange={(e) => set("accent", e.target.value)}
          />
        </Box>
        <Box>
          <Text asChild fontSize="xs" color="fg.muted">
            <label htmlFor="embed-bg">Background</label>
          </Text>
          <Input
            id="embed-bg"
            type="color"
            size="sm"
            w="48px"
            p={0.5}
            value={value.bg ?? "#FCFBF9"}
            onChange={(e) => set("bg", e.target.value)}
          />
        </Box>
      </Flex>
      <Box
        data-testid="embed-theme-preview"
        mt={2}
        p={3}
        borderRadius="control"
        border="1px solid"
        borderColor="brand.border"
        style={{ background: value.bg ?? "#FCFBF9" }}
      >
        <Heading
          size="sm"
          style={{
            fontFamily: value.headingFont
              ? `"${value.headingFont}", sans-serif`
              : undefined,
            color: value.accent ?? undefined,
          }}
        >
          Chapter heading
        </Heading>
        <Text
          fontSize="sm"
          mt={1}
          style={{
            fontFamily: value.bodyFont
              ? `"${value.bodyFont}", sans-serif`
              : undefined,
          }}
        >
          Body text will render in this font inside the embedded story.
        </Text>
      </Box>
      <Text fontSize="xs" color="fg.muted" mt={1}>
        Fonts load from Google Fonts. Leave blank to keep the default look.
      </Text>
    </Box>
  );
}
