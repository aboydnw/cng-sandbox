import {
  Box,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Flex,
  IconButton,
  Portal,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { X } from "@phosphor-icons/react";
import { createOverlayConfig } from "../lib/story/types";
import type { OverlayConfig } from "../lib/story/types";
import type { Dataset, Connection } from "../types";

interface OverlayPickerProps {
  open: boolean;
  datasets: Dataset[];
  connections: Connection[];
  onClose: () => void;
  onSelect: (overlay: OverlayConfig) => void;
}

function PickerRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Box
      role="button"
      tabIndex={0}
      px={3}
      py={2}
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="md"
      cursor="pointer"
      _hover={{ bg: "brand.bgSubtle", borderColor: "brand.orange" }}
      _focusVisible={{
        outline: "2px solid",
        outlineColor: "brand.border",
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <Text fontSize="sm" color="brand.brown" truncate>
        {label}
      </Text>
    </Box>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Text fontSize="sm" color="fg.muted" py={2}>
      {message}
    </Text>
  );
}

export function OverlayPicker({
  open,
  datasets,
  connections,
  onClose,
  onSelect,
}: OverlayPickerProps) {
  const exampleConnections = connections.filter((c) => c.is_example_copy);
  const myConnections = connections.filter((c) => !c.is_example_copy);

  const pick = (overlay: OverlayConfig) => {
    onSelect(overlay);
    onClose();
  };

  return (
    <DialogRoot
      open={open}
      onOpenChange={(e) => !e.open && onClose()}
      size="md"
    >
      <Portal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent shadow="lg">
            <DialogHeader>
              <DialogTitle>Add overlay layer</DialogTitle>
            </DialogHeader>
            <DialogCloseTrigger asChild>
              <IconButton
                size="sm"
                variant="ghost"
                onClick={onClose}
                aria-label="Close"
                _hover={{ bg: "brand.bgSubtle", color: "brand.orange" }}
                _focusVisible={{
                  outline: "2px solid",
                  outlineColor: "brand.border",
                }}
              >
                <X size={16} />
              </IconButton>
            </DialogCloseTrigger>
            <DialogBody pb={4}>
              <Tabs.Root defaultValue="datasets">
                <Tabs.List>
                  <Tabs.Trigger value="datasets">My datasets</Tabs.Trigger>
                  <Tabs.Trigger value="connections">
                    My connections
                  </Tabs.Trigger>
                  <Tabs.Trigger value="examples">Examples</Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="datasets">
                  <Flex direction="column" gap={2}>
                    {datasets.length === 0 ? (
                      <EmptyState message="No vector datasets available." />
                    ) : (
                      datasets.map((d) => (
                        <PickerRow
                          key={d.id}
                          label={d.filename}
                          onClick={() =>
                            pick(createOverlayConfig({ dataset_id: d.id }))
                          }
                        />
                      ))
                    )}
                  </Flex>
                </Tabs.Content>
                <Tabs.Content value="connections">
                  <Flex direction="column" gap={2}>
                    {myConnections.length === 0 ? (
                      <EmptyState message="No vector connections available." />
                    ) : (
                      myConnections.map((c) => (
                        <PickerRow
                          key={c.id}
                          label={c.name}
                          onClick={() =>
                            pick(createOverlayConfig({ connection_id: c.id }))
                          }
                        />
                      ))
                    )}
                  </Flex>
                </Tabs.Content>
                <Tabs.Content value="examples">
                  <Flex direction="column" gap={2}>
                    {exampleConnections.length === 0 ? (
                      <EmptyState message="No example overlay layers available." />
                    ) : (
                      exampleConnections.map((c) => (
                        <PickerRow
                          key={c.id}
                          label={c.name}
                          onClick={() =>
                            pick(createOverlayConfig({ connection_id: c.id }))
                          }
                        />
                      ))
                    )}
                  </Flex>
                </Tabs.Content>
              </Tabs.Root>
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
