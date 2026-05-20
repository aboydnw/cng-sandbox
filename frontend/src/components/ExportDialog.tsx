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
import { ExportProgress } from "./ExportProgress";
import { useArchivalDownload } from "../lib/story/useArchivalDownload";
import { useInteractiveDownload } from "../lib/story/useInteractiveDownload";
import type { Story } from "../lib/story";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  story: Story;
}

export function ExportDialog({ open, onClose, story }: ExportDialogProps) {
  const archival = useArchivalDownload(story.id, story.title);
  const interactive = useInteractiveDownload(story.id, story.title);

  const activeExport = interactive.progress.open
    ? {
        progress: interactive.progress,
        onCancel: interactive.handleCancelInteractive,
        title: "Building interactive bundle",
        body: "Capturing chapters and assembling .zip…",
      }
    : archival.progress.open
      ? {
          progress: archival.progress,
          onCancel: archival.handleCancelArchival,
          title: "Building archival HTML",
          body: "Capturing chapters and assembling HTML…",
        }
      : null;

  return (
    <>
      <ExportProgress
        open={activeExport !== null}
        current={activeExport?.progress.current ?? 0}
        total={activeExport?.progress.total ?? 0}
        title={activeExport?.title ?? ""}
        body={activeExport?.body ?? ""}
        onCancel={activeExport?.onCancel}
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
                  hideHeader
                  onArchival={() => {
                    void archival.handleArchival();
                  }}
                  onInteractive={() => {
                    void interactive.handleInteractive();
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
