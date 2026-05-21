import {
  Box,
  Button,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Flex,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { X } from "@phosphor-icons/react";

export interface ExportProgressProps {
  open: boolean;
  current: number;
  total: number;
  title: string;
  body: string;
  finalizingBody?: string;
  onCancel?: () => void;
}

export function ExportProgress({
  open,
  current,
  total,
  title,
  body,
  finalizingBody = "Finalizing download…",
  onCancel,
}: ExportProgressProps) {
  const pct = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  const finalizing = current >= total && total > 0;
  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onCancel?.()}
      size="sm"
    >
      <Portal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent shadow="lg">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {onCancel ? (
              <DialogCloseTrigger asChild>
                <IconButton
                  size="sm"
                  variant="ghost"
                  onClick={onCancel}
                  aria-label="Cancel export"
                  title="Cancel export"
                  _hover={{ bg: "brand.bgSubtle", color: "brand.orange" }}
                  _focusVisible={{
                    outline: "2px solid",
                    outlineColor: "brand.border",
                  }}
                >
                  <X size={16} />
                </IconButton>
              </DialogCloseTrigger>
            ) : null}
            <DialogBody>
              <Text fontSize="sm" mb={2}>
                {finalizing ? finalizingBody : body}
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
            {onCancel ? (
              <DialogFooter>
                <Flex justify="flex-end" w="100%">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onCancel}
                    disabled={finalizing}
                  >
                    Cancel export
                  </Button>
                </Flex>
              </DialogFooter>
            ) : null}
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
