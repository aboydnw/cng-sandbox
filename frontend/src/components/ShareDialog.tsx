import { useRef, useState } from "react";
import {
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
  Spinner,
  Text,
} from "@chakra-ui/react";
import {
  CheckCircle,
  Copy,
  LinkBreak,
  ShareNetwork,
} from "@phosphor-icons/react";
import { connectionsApi, datasetsApi } from "../lib/api";

interface ShareDialogProps {
  kind: "dataset" | "connection";
  resourceId: string;
  isShared: boolean;
  isOpen: boolean;
  onClose(): void;
  onSharedChange(newValue: boolean): void;
}

export function ShareDialog({
  kind,
  resourceId,
  isShared,
  isOpen,
  onClose,
  onSharedChange,
}: ShareDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const shareUrl =
    kind === "connection"
      ? `${window.location.origin}/map/connection/${resourceId}`
      : `${window.location.origin}/map/${resourceId}`;

  function handleClose() {
    setError(null);
    setCopied(false);
    onClose();
  }

  async function handleShare() {
    setLoading(true);
    setError(null);
    try {
      const api = kind === "connection" ? connectionsApi : datasetsApi;
      await api.share(resourceId, true);
      onSharedChange(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleStopSharing() {
    setLoading(true);
    setError(null);
    try {
      const api = kind === "connection" ? connectionsApi : datasetsApi;
      await api.share(resourceId, false);
      onSharedChange(false);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && handleClose()}
      size="md"
    >
      <Portal>
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent shadow="lg">
            <DialogHeader>
              <DialogTitle>
                {isShared ? "Public link" : "Share publicly"}
              </DialogTitle>
              <CloseButton size="sm" onClick={handleClose} />
            </DialogHeader>

            <DialogBody>
              {isShared ? (
                <Flex direction="column" gap={3}>
                  <Text fontSize="sm" color="gray.600">
                    Anyone with this link can view this {kind} without signing
                    in.
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
                </Flex>
              ) : (
                <Text fontSize="sm" color="gray.600">
                  This will make the resource publicly accessible via a direct
                  link. Anyone with the link will be able to view it without
                  signing in.
                </Text>
              )}
              {error && (
                <Text fontSize="sm" color="red.500" mt={3}>
                  {error}
                </Text>
              )}
            </DialogBody>

            <DialogFooter>
              {isShared ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    color="red.600"
                    _hover={{ bg: "red.50" }}
                    onClick={handleStopSharing}
                    disabled={loading}
                  >
                    {loading ? <Spinner size="xs" /> : <LinkBreak size={14} />}
                    Stop sharing
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.orange"
                    color="white"
                    _hover={{ bg: "brand.orangeHover" }}
                    onClick={handleClose}
                  >
                    Done
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.orange"
                    color="white"
                    _hover={{ bg: "brand.orangeHover" }}
                    onClick={handleShare}
                    disabled={loading}
                  >
                    {loading ? (
                      <Spinner size="xs" />
                    ) : (
                      <ShareNetwork size={14} />
                    )}
                    Share
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </Portal>
    </DialogRoot>
  );
}
