import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge, Box, Button, Flex, Text } from "@chakra-ui/react";
import {
  ResourceCollection,
  ResourceCollectionCell,
  ResourceCollectionRow,
} from "../components/ui/ResourceCollection";
import { CollectionSkeleton } from "../components/ui/CollectionSkeleton";
import { ResourceThumbnail } from "../components/ui/ResourceThumbnail";

const meta = {
  title: "Components/Resource collection",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <Box p={{ base: 4, md: 8 }} bg="bg" minH="100vh">
        <Story />
      </Box>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const columns = "minmax(0, 1fr) 140px 120px 110px";

export const WithResources: Story = {
  render: () => (
    <Box maxW="960px">
      <ResourceCollection
        columns={columns}
        headers={["Dataset", "Type", "Updated", "Actions"]}
      >
        {[
          ["Chesapeake land cover", "Raster", "12 minutes ago", "raster"],
          ["Maryland watersheds", "Vector", "Yesterday", "vector"],
          ["White stork migration", "Trajectory", "3 days ago", "trajectory"],
        ].map(([name, type, updated, kind]) => (
          <ResourceCollectionRow key={name} columns={columns}>
            <ResourceCollectionCell label="Dataset" primary>
              <Flex align="center" gap={3}>
                <ResourceThumbnail
                  alt={name}
                  kind={kind as "raster" | "vector" | "trajectory"}
                />
                <Text textStyle="cardTitle">{name}</Text>
              </Flex>
            </ResourceCollectionCell>
            <ResourceCollectionCell label="Type">
              <Badge variant="subtle">{type}</Badge>
            </ResourceCollectionCell>
            <ResourceCollectionCell label="Updated">
              <Text color="fg.muted" textStyle="metadata">
                {updated}
              </Text>
            </ResourceCollectionCell>
            <ResourceCollectionCell label="Actions">
              <Button size="sm" variant="outline">
                Open
              </Button>
            </ResourceCollectionCell>
          </ResourceCollectionRow>
        ))}
      </ResourceCollection>
    </Box>
  ),
};

export const Loading: Story = {
  render: () => (
    <Box maxW="960px">
      <CollectionSkeleton rows={3} />
    </Box>
  ),
};
