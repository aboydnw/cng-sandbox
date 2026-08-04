import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

const meta = {
  title: "Components/Confirm dialog",
  component: ConfirmDialog,
  args: {
    open: true,
    title: "Delete Chesapeake land cover?",
    description:
      "This removes the dataset from this workspace. This action cannot be undone.",
    confirmLabel: "Delete dataset",
    onConfirm: () => undefined,
    onOpenChange: () => undefined,
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Confirmation: Story = {};

export const RequestFailed: Story = {
  args: {
    error: "The dataset could not be deleted. Your data is unchanged.",
  },
};

export const Submitting: Story = {
  args: { loading: true },
};
