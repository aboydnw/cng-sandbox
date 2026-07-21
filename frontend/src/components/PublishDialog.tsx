import { useEffect, useRef, useState } from "react";
import {
  Badge,
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
  Input,
  Portal,
  Text,
} from "@chakra-ui/react";
import { CheckCircle, Copy, Warning, X } from "@phosphor-icons/react";
import type { Story } from "../lib/story";
import { isMapBoundChapter } from "../lib/story";
import { useArchivalDownload } from "../lib/story/useArchivalDownload";
import { useInteractiveDownload } from "../lib/story/useInteractiveDownload";
import { ExportProgress } from "./ExportProgress";
import { ExportSection } from "./ExportSection";
import { storyReadiness } from "../lib/story/readiness";

interface PublishDialogProps {
  open: boolean;
  story: Story;
  shareUrl: string;
  onPublish: () => void;
  onClose: () => void;
}

export function PublishDialog({
  open,
  story,
  shareUrl,
  onPublish,
  onClose,
}: PublishDialogProps) {
  const [published, setPublished] = useState(story.published);
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
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

  const readiness = storyReadiness(story);

  useEffect(() => {
    if (open) setPublished(story.published);
  }, [open, story.published]);

  function handlePublish() {
    if (!readiness.readyToPublish) return;
    onPublish();
    setPublished(true);
  }

  function handleCopy() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      urlInputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleClose() {
    setCopied(false);
    onClose();
  }

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
        onOpenChange={(e) => !e.open && handleClose()}
        size="md"
      >
        <Portal>
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent shadow="lg">
              <DialogHeader>
                <DialogTitle>
                  {published ? "Story published" : "Publish story"}
                </DialogTitle>
              </DialogHeader>
              <DialogCloseTrigger asChild>
                <IconButton
                  size="sm"
                  variant="ghost"
                  onClick={handleClose}
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

              <DialogBody>
                {!published ? (
                  <Flex direction="column" gap={4}>
                    <Box>
                      <Text fontWeight={600} fontSize="sm" mb={1}>
                        {story.title || "Untitled story"}
                      </Text>
                      <Text fontSize="sm" color="gray.500">
                        {story.chapters.length} chapter
                        {story.chapters.length !== 1 ? "s" : ""}
                      </Text>
                    </Box>

                    <Box>
                      <Text
                        fontSize="xs"
                        fontWeight={600}
                        color="gray.500"
                        mb={2}
                        textTransform="uppercase"
                        letterSpacing="wider"
                      >
                        Chapters
                      </Text>
                      <Flex direction="column" gap={1.5}>
                        {story.chapters.map((ch) => {
                          const hasNarrative = ch.narrative.trim().length > 0;
                          const isMapBound = isMapBoundChapter(ch);
                          const hasMap =
                            isMapBound && !!ch.layer_config.dataset_id;
                          return (
                            <Flex
                              key={ch.id}
                              align="center"
                              gap={2}
                              justify="space-between"
                            >
                              <Text fontSize="sm" truncate maxW="60%">
                                {ch.title || "Untitled chapter"}
                              </Text>
                              <Flex gap={1.5} align="center">
                                <Badge
                                  size="sm"
                                  colorPalette={hasNarrative ? "green" : "gray"}
                                  variant="subtle"
                                >
                                  Narrative
                                </Badge>
                                {isMapBound && (
                                  <Badge
                                    size="sm"
                                    colorPalette={hasMap ? "green" : "gray"}
                                    variant="subtle"
                                  >
                                    Map
                                  </Badge>
                                )}
                              </Flex>
                            </Flex>
                          );
                        })}
                      </Flex>
                    </Box>

                    {readiness.blocking.length > 0 && (
                      <Box
                        role="alert"
                        bg="status.danger.subtle"
                        border="1px solid"
                        borderColor="status.danger.border"
                        borderRadius="panel"
                        p={3}
                      >
                        <Flex
                          align="center"
                          gap={2}
                          color="status.danger.fg"
                          mb={2}
                        >
                          <Warning size={16} weight="fill" />
                          <Text fontSize="sm" fontWeight="semibold">
                            Finish before publishing
                          </Text>
                        </Flex>
                        {readiness.blocking.map((issue) => (
                          <Text
                            key={issue.id}
                            fontSize="sm"
                            color="status.danger.fg"
                          >
                            {issue.message}
                          </Text>
                        ))}
                      </Box>
                    )}

                    {readiness.advisory.length > 0 && (
                      <Flex
                        role="status"
                        align="flex-start"
                        gap={2}
                        bg="status.warning.subtle"
                        border="1px solid"
                        borderColor="status.warning.border"
                        borderRadius="panel"
                        p={3}
                      >
                        <Box color="status.warning.fg" flexShrink={0} mt={0.5}>
                          <Warning size={16} />
                        </Box>
                        <Box>
                          <Text
                            fontSize="sm"
                            color="status.warning.fg"
                            fontWeight="semibold"
                          >
                            Review before sharing
                          </Text>
                          {readiness.advisory.slice(0, 4).map((issue) => (
                            <Text
                              key={issue.id}
                              fontSize="xs"
                              color="status.warning.fg"
                              mt={1}
                            >
                              {issue.message}
                            </Text>
                          ))}
                          {readiness.advisory.length > 4 && (
                            <Text
                              fontSize="xs"
                              color="status.warning.fg"
                              mt={1}
                            >
                              And {readiness.advisory.length - 4} more item
                              {readiness.advisory.length - 4 === 1 ? "" : "s"}.
                            </Text>
                          )}
                        </Box>
                      </Flex>
                    )}
                  </Flex>
                ) : (
                  <Flex direction="column" gap={4}>
                    <Flex align="center" gap={2} color="green.600">
                      <CheckCircle size={20} weight="fill" />
                      <Text fontWeight={500} fontSize="sm">
                        Your story is now live and shareable.
                      </Text>
                    </Flex>
                    <Box>
                      <Text
                        fontSize="xs"
                        fontWeight={600}
                        color="gray.500"
                        mb={1.5}
                        textTransform="uppercase"
                        letterSpacing="wider"
                      >
                        Shareable URL
                      </Text>
                      <Flex gap={2}>
                        <Input
                          ref={urlInputRef}
                          value={shareUrl}
                          readOnly
                          size="sm"
                          fontSize="xs"
                          fontFamily="mono"
                          bg="gray.50"
                          onClick={() => urlInputRef.current?.select()}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCopy}
                          flexShrink={0}
                        >
                          {copied ? (
                            <CheckCircle size={14} weight="fill" />
                          ) : (
                            <Copy size={14} />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </Flex>
                    </Box>
                    <ExportSection
                      story={story}
                      onArchival={() => {
                        void archival.handleArchival();
                      }}
                      onInteractive={() => {
                        void interactive.handleInteractive();
                      }}
                    />
                  </Flex>
                )}
              </DialogBody>

              <DialogFooter>
                {!published ? (
                  <>
                    <Button variant="ghost" size="sm" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      bg="brand.orange"
                      color="white"
                      _hover={{ bg: "brand.orangeHover" }}
                      onClick={handlePublish}
                      disabled={!readiness.readyToPublish}
                    >
                      Publish
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={handleClose}>
                    Done
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </DialogPositioner>
        </Portal>
      </DialogRoot>
    </>
  );
}
