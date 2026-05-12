import {
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  IconButton,
  Portal,
  Text,
} from "@chakra-ui/react";
import { X } from "@phosphor-icons/react";
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
