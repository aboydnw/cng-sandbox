import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Flex, IconButton, Stack, Text } from "@chakra-ui/react";
import { Camera, Trash } from "@phosphor-icons/react";

const meta = {
  title: "Components/Buttons",
  component: Button,
  args: { children: "Create map" },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Variants: Story = {
  render: () => (
    <Flex gap={3} wrap="wrap" align="center">
      {(
        ["solid", "subtle", "surface", "outline", "ghost", "plain"] as const
      ).map((variant) => (
        <Button key={variant} variant={variant}>
          {variant}
        </Button>
      ))}
    </Flex>
  ),
};

export const SizesAndStates: Story = {
  render: () => (
    <Stack gap={5}>
      <Flex gap={3} wrap="wrap" align="center">
        {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
          <Button key={size} size={size}>
            {size}
          </Button>
        ))}
      </Flex>
      <Flex gap={3} wrap="wrap">
        <Button disabled>Disabled</Button>
        <Button loading>Creating map</Button>
        <IconButton aria-label="Save map as PNG" variant="surface">
          <Camera size={18} />
        </IconButton>
        <Button
          bg="status.danger.fg"
          color="action.onPrimary"
          _hover={{ bg: "status.danger.hover" }}
        >
          <Trash size={18} /> Delete dataset
        </Button>
      </Flex>
      <Text color="fg.muted" maxW="65ch">
        Keyboard focus uses the shared focus ring. Use only one visually primary
        action in a local decision group.
      </Text>
    </Stack>
  ),
};
