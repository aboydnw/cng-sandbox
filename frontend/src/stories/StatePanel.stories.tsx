import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "@chakra-ui/react";
import { StatePanel } from "../components/ui/StatePanel";

const meta = {
  title: "Components/State panel",
  component: StatePanel,
  args: {
    title: "No stories yet",
    description: "Create a story to combine maps, media, and narrative.",
  },
} satisfies Meta<typeof StatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
  render: () => (
    <Stack gap={4} maxW="680px">
      <StatePanel
        title="Nothing here yet"
        description="This collection is empty."
      />
      <StatePanel
        tone="info"
        title="Rendered in your browser"
        description="This raster is eligible for client-side rendering."
      />
      <StatePanel
        tone="success"
        title="Conversion complete"
        description="The dataset is ready to map."
      />
      <StatePanel
        tone="warning"
        title="Some data is unavailable"
        description="The map remains usable, but one overlay could not be loaded."
      />
      <StatePanel
        tone="danger"
        title="Datasets could not be loaded"
        description="Your existing data is unchanged."
      />
    </Stack>
  ),
};

export const RecoveryAction: Story = {
  args: {
    tone: "danger",
    title: "Connections could not be loaded",
    description: "Datasets are still available. Try loading connections again.",
    actionLabel: "Try again",
    onAction: () => undefined,
  },
};

export const Compact: Story = {
  args: {
    compact: true,
    tone: "warning",
    title: "Dataset unavailable",
    description: "Choose a replacement to continue editing this chapter.",
  },
};
