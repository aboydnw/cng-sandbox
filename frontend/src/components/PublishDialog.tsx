import { useRef, useState } from "react";
import {
  Badge,
  Box,
  Button,
  CloseButton,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Flex,
  Input,
  Portal,
  Text,
} from "@chakra-ui/react";
import { CheckCircle, Copy, Warning } from "@phosphor-icons/react";
import type { Story } from "../lib/story";
import { isMapBoundChapter } from "../lib/story";
import { downloadStoryConfig } from "../lib/story/exportConfig";
import { EmbedSnippet } from "./EmbedSnippet";

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

  const incompleteChapters = story.chapters.filter(
    (ch) => !ch.narrative.trim()
  );
  const hasIncomplete = incompleteChapters.length > 0;

  function handlePublish() {
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
              <CloseButton size="sm" onClick={handleClose} />
            </DialogHeader>

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

                  {hasIncomplete && (
                    <Flex
                      align="flex-start"
                      gap={2}
                      bg="orange.50"
                      border="1px solid"
                      borderColor="orange.200"
                      borderRadius="md"
                      p={3}
                    >
                      <Box color="orange.500" flexShrink={0} mt={0.5}>
                        <Warning size={16} />
                      </Box>
                      <Text fontSize="sm" color="orange.700">
                        {incompleteChapters.length} chapter
                        {incompleteChapters.length !== 1 ? "s have" : " has"} no
                        narrative text. Readers will see empty chapters.
                      </Text>
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
                  <Box mt={6}>
                    <Text
                      fontSize="xs"
                      fontWeight={600}
                      color="gray.500"
                      mb={1.5}
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      Export
                    </Text>
                    <Text fontSize="sm" color="fg.muted" mb={3}>
                      Download a portable representation of this story.
                    </Text>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void downloadStoryConfig(story.id, story.title).catch(
                          (err) => {
                            console.error(
                              "Failed to download story config",
                              err
                            );
                          }
                        );
                      }}
                    >
                      Download story config (cng-rc.json)
                    </Button>
                    <Box mt={4}>
                      <EmbedSnippet
                        viewerOrigin={
                          import.meta.env.VITE_VIEWER_ORIGIN ??
                          window.location.origin
                        }
                        storyId={story.id}
                        configUrl={`${window.location.origin}/api/stories/${story.id}/export/config`}
                      />
                    </Box>
                  </Box>
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
  );
}
