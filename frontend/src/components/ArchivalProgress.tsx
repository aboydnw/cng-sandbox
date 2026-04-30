import {
  Box,
  CloseButton,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Portal,
  Text,
} from "@chakra-ui/react";

export interface ArchivalProgressProps {
  open: boolean;
  current: number;
  total: number;
  onClose?: () => void;
}

export function ArchivalProgress({
  open,
  current,
  total,
  onClose,
}: ArchivalProgressProps) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose?.()}
      size="sm"
    >
      <Portal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent shadow="lg">
            <DialogHeader>
              <DialogTitle>Building archival HTML</DialogTitle>
              {onClose ? <CloseButton size="sm" onClick={onClose} /> : null}
            </DialogHeader>
            <DialogBody>
              <Text fontSize="sm" mb={2}>
                Capturing chapter {current} of {total}…
              </Text>
              <Box bg="gray.100" borderRadius="md" h="6px" overflow="hidden">
                <Box
                  bg="brand.orange"
                  h="100%"
                  w={`${pct}%`}
                  transition="width 0.2s"
                />
              </Box>
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
