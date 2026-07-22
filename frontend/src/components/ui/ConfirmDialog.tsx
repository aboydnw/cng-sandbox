import { Button, Dialog, Portal, Text } from "@chakra-ui/react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Delete",
  loading = false,
  onConfirm,
  onOpenChange,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => {
        if (!loading) onOpenChange(details.open);
      }}
      role="alertdialog"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content maxW="440px" borderRadius="panel">
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              <Text color="fg.muted" lineHeight="1.6">
                {description}
              </Text>
            </Dialog.Body>
            <Dialog.Footer gap={2}>
              <Dialog.ActionTrigger asChild>
                <Button variant="outline" disabled={loading}>
                  Cancel
                </Button>
              </Dialog.ActionTrigger>
              <Button
                bg="status.danger.fg"
                color="action.onPrimary"
                _hover={{ bg: "status.danger.hover" }}
                loading={loading}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
