import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Grid, Heading, Stack, Text } from "@chakra-ui/react";

const meta = {
  title: "Foundations/Design tokens",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const semanticColors = [
  ["bg", "Page canvas"],
  ["bg.subtle", "Quiet surface"],
  ["bg.raised", "Raised surface"],
  ["bg.emphasized", "Selected or emphasized surface"],
  ["fg", "Primary text"],
  ["fg.muted", "Supporting text"],
  ["action.primary", "Primary action"],
  ["status.success.subtle", "Success surface"],
  ["status.warning.subtle", "Warning surface"],
  ["status.danger.subtle", "Danger surface"],
  ["status.info.subtle", "Information surface"],
] as const;

export const Colors: Story = {
  render: () => (
    <Box bg="bg" color="fg" minH="100vh" p={{ base: 6, md: 10 }}>
      <Heading textStyle="pageTitle">Semantic colors</Heading>
      <Text color="fg.muted" mt={2} mb={8} maxW="65ch">
        Reusable interface work names the role a color plays. Data,
        user-authored, and rendering-boundary colors remain outside this set.
      </Text>
      <Grid
        templateColumns="repeat(auto-fit, minmax(210px, 1fr))"
        gap={4}
        maxW="1100px"
      >
        {semanticColors.map(([token, description]) => (
          <Box
            key={token}
            bg={token}
            color={
              token === "fg"
                ? "bg.raised"
                : token.startsWith("status.")
                  ? "fg"
                  : undefined
            }
            border="1px solid"
            borderColor="border"
            borderRadius="panel"
            minH="124px"
            p={4}
          >
            <Text textStyle="label">{token}</Text>
            <Text color={token === "fg" ? "bg.raised" : "fg.muted"} mt={2}>
              {description}
            </Text>
          </Box>
        ))}
      </Grid>
    </Box>
  ),
};

const textStyles = [
  ["display", "Display", "A rare, prominent product statement"],
  ["pageTitle", "Page title", "The primary identity of an application page"],
  ["sectionTitle", "Section title", "A major group within a page"],
  ["cardTitle", "Card title", "A selectable object or compact panel title"],
  ["body", "Body", "Instructions and narrative copy for everyday reading"],
  ["label", "Label", "Field and compact control labels"],
  ["metadata", "Metadata", "Type, time, size, status, and supporting facts"],
] as const;

export const Typography: Story = {
  render: () => (
    <Stack gap={8} maxW="900px">
      {textStyles.map(([style, label, example]) => (
        <Box key={style} borderBottom="1px solid" borderColor="border" pb={6}>
          <Text textStyle="metadata" color="fg.muted" mb={2}>
            {style}
          </Text>
          <Text textStyle={style}>{label}</Text>
          <Text color="fg.muted" mt={2} maxW="65ch">
            {example}
          </Text>
        </Box>
      ))}
    </Stack>
  ),
};

export const ShapeDepthAndMotion: Story = {
  render: () => (
    <Stack gap={8} maxW="760px">
      <Box>
        <Heading textStyle="sectionTitle" mb={4}>
          Shape and depth
        </Heading>
        <Grid templateColumns={{ base: "1fr", sm: "1fr 1fr" }} gap={4}>
          <Box
            bg="bg.raised"
            border="1px solid"
            borderColor="border"
            p={5}
            borderRadius="control"
          >
            <Text textStyle="label">control · 8px</Text>
          </Box>
          <Box bg="bg.raised" shadow="md" p={5} borderRadius="panel">
            <Text textStyle="label">panel · 12px · md shadow</Text>
          </Box>
        </Grid>
      </Box>
      <Box>
        <Heading textStyle="sectionTitle" mb={4}>
          Motion
        </Heading>
        <Stack gap={2} color="fg.muted">
          <Text>
            <strong>fast · 180ms</strong> — hover, press, and small disclosures
          </Text>
          <Text>
            <strong>moderate · 240ms</strong> — ordinary component transitions
          </Text>
          <Text>
            <strong>slow · 340ms</strong> — panels and larger layout changes
          </Text>
        </Stack>
      </Box>
    </Stack>
  ),
};
