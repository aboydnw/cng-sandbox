import { useState } from "react";
import {
  Button,
  CloseButton,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { LinkBreak, ShareNetwork } from "@phosphor-icons/react";
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

  function handleClose() {
    setError(null);
    onClose();
  }

  async function handleAction() {
    setLoading(true);
    setError(null);
    try {
      const api = kind === "connection" ? connectionsApi : datasetsApi;
      await api.share(resourceId, !isShared);
      onSharedChange(!isShared);
      onClose();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DialogRoot
      open={isOpen}
      onOpenChange={(e) => !e.open && handleClose()}
      size="md"
    >
      <DialogBackdrop />
      <DialogContent shadow="lg">
        <DialogHeader>
          <DialogTitle>
            {isShared ? "Stop sharing" : "Share publicly"}
          </DialogTitle>
          <CloseButton size="sm" onClick={handleClose} />
        </DialogHeader>

        <DialogBody>
          {isShared ? (
            <Text fontSize="sm" color="gray.600">
              This will revoke public access. Anyone with a direct link will no
              longer be able to view this resource.
            </Text>
          ) : (
            <Text fontSize="sm" color="gray.600">
              This will make the resource publicly accessible via a direct link.
              Anyone with the link will be able to view it without signing in.
            </Text>
          )}
          {error && (
            <Text fontSize="sm" color="red.500" mt={3}>
              {error}
            </Text>
          )}
        </DialogBody>

        <DialogFooter>
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
            bg={isShared ? "red.500" : "brand.orange"}
            color="white"
            _hover={{ bg: isShared ? "red.600" : "brand.orangeHover" }}
            onClick={handleAction}
            disabled={loading}
          >
            {loading ? (
              <Spinner size="xs" />
            ) : isShared ? (
              <LinkBreak size={14} />
            ) : (
              <ShareNetwork size={14} />
            )}
            {isShared ? "Stop sharing" : "Share"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
