import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Button, Flex } from "@chakra-ui/react";
import { PageHeader } from "../components/PageHeader";
import { SnapButton } from "../components/SnapButton";

const meta = {
  title: "Patterns/Page and map actions",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const PageHeading: Story = {
  render: () => (
    <PageHeader
      title="Data"
      description="Upload files, connect remote datasets, and return to work already in this workspace."
      actions={
        <>
          <Button variant="outline">Connect data</Button>
          <Button>Upload data</Button>
        </>
      }
    />
  ),
};

export const SnapshotStates: Story = {
  render: () => (
    <Box
      minH="260px"
      borderRadius="panel"
      position="relative"
      overflow="hidden"
      bg="linear-gradient(135deg, #d8e2d0 0%, #9eb79d 45%, #657f73 100%)"
    >
      <Flex position="absolute" top={4} right={4} gap={3}>
        <SnapButton
          onSnap={() => undefined}
          isCapturing={false}
          error={false}
        />
        <SnapButton onSnap={() => undefined} isCapturing error={false} />
        <SnapButton onSnap={() => undefined} isCapturing={false} error />
      </Flex>
    </Box>
  ),
};
