import { useEffect, useState } from "react";
import {
  Button,
  CloseButton,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { listStoriesFromServer } from "../lib/story/api";
import { ExportDialog } from "./ExportDialog";
import type { Story } from "../lib/story";

interface ExportPickerDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportPickerDialog({ open, onClose }: ExportPickerDialogProps) {
  const [stories, setStories] = useState<Story[]>([]);
  const [picked, setPicked] = useState<Story | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(null);
    listStoriesFromServer()
      .then((rows) => setStories(rows.filter((s) => !s.is_example)))
      .catch(() => {
        setLoadError("Could not load stories. Please try again.");
        setStories([]);
      })
      .finally(() => setLoading(false));
  }, [open]);

  if (picked) {
    return (
      <ExportDialog
        open
        story={picked}
        onClose={() => {
          setPicked(null);
          onClose();
        }}
      />
    );
  }

  return (
    <DialogRoot
      open={open}
      onOpenChange={(d) => !d.open && onClose()}
      size="md"
    >
      <Portal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent shadow="lg">
            <DialogHeader>
              <DialogTitle>Pick a story to export</DialogTitle>
              <CloseButton size="sm" onClick={onClose} aria-label="Close" />
            </DialogHeader>
            <DialogBody>
              {loading ? (
                <Text fontSize="sm" color="fg.muted">
                  Loading stories…
                </Text>
              ) : loadError ? (
                <Text fontSize="sm" color="red.600">
                  {loadError}
                </Text>
              ) : stories.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  You have no stories yet. Start one from the Stories tab.
                </Text>
              ) : (
                <Flex direction="column" gap={2}>
                  {stories.map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      justifyContent="flex-start"
                      onClick={() => setPicked(s)}
                    >
                      {s.title || "Untitled story"}
                    </Button>
                  ))}
                </Flex>
              )}
            </DialogBody>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
