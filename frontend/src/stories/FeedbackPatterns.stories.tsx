import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Grid, Stack, Text } from "@chakra-ui/react";
import { SaveStatus } from "../components/SaveStatus";
import { ProgressTracker } from "../components/ProgressTracker";
import type { StageInfo } from "../types";

const meta = {
  title: "Patterns/Feedback",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SaveStates: Story = {
  render: () => (
    <Grid templateColumns="auto 1fr" gapX={6} gapY={4} alignItems="center">
      {(["saving", "saved", "error"] as const).map((state) => (
        <Box key={state} display="contents">
          <Text textStyle="metadata" color="fg.muted">
            {state}
          </Text>
          <SaveStatus state={state} />
        </Box>
      ))}
    </Grid>
  ),
};

const activeStages: StageInfo[] = [
  { name: "Uploading", status: "done" },
  { name: "Checking format", status: "done" },
  {
    name: "Converting",
    status: "active",
    progress: { percent: 63, current: null, total: null, detail: null },
  },
  { name: "Storing", status: "pending" },
  { name: "Registering", status: "pending" },
];

export const ConversionInProgress: Story = {
  render: () => (
    <Box maxW="560px">
      <ProgressTracker
        stages={activeStages}
        filename="chesapeake-land-cover.tif"
        fileSize="86.4 MB"
        embedded
      />
    </Box>
  ),
};

export const ConversionFailed: Story = {
  render: () => (
    <Stack maxW="560px">
      <ProgressTracker
        stages={[
          { name: "Uploading", status: "done" },
          {
            name: "Checking format",
            status: "error",
            detail:
              "This GeoTIFF does not define a coordinate reference system.",
          },
          { name: "Converting", status: "pending" },
        ]}
        filename="wetlands.tif"
        fileSize="24.7 MB"
        onRetry={() => undefined}
        onReport={() => undefined}
        embedded
      />
    </Stack>
  ),
};
