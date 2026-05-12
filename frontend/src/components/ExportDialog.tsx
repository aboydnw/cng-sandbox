import {
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
import { ExportSection } from "./ExportSection";
import { ArchivalProgress } from "./ArchivalProgress";
import { useArchivalDownload } from "../lib/story/useArchivalDownload";
import type { Story } from "../lib/story";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  story: Story;
}

export function ExportDialog({ open, onClose, story }: ExportDialogProps) {
  const { progress, handleArchival, handleCancelArchival } =
    useArchivalDownload(story.id, story.title);

  return (
    <>
      <ArchivalProgress
        open={progress.open}
        current={progress.current}
        total={progress.total}
        onClose={handleCancelArchival}
      />
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
                <DialogTitle>
                  Export &ldquo;{story.title || "Untitled story"}&rdquo;
                </DialogTitle>
                <CloseButton size="sm" onClick={onClose} aria-label="Close" />
              </DialogHeader>
              <DialogBody>
                <Text fontSize="sm" color="fg.muted" mb={2}>
                  Download a portable representation of this story. Works on
                  drafts and published stories.
                </Text>
                <ExportSection
                  story={story}
                  onArchival={() => {
                    void handleArchival();
                  }}
                />
              </DialogBody>
            </DialogContent>
          </DialogPositioner>
        </Portal>
      </DialogRoot>
    </>
  );
}
