import { useCallback, useEffect, useState } from "react";
import {
  Button,
  DialogBackdrop,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
  Flex,
  Portal,
  Text,
} from "@chakra-ui/react";
import { Trash, Plus } from "@phosphor-icons/react";
import { useWorkspace } from "../hooks/useWorkspace";
import {
  getExampleState,
  removeExampleData,
  seedExampleData,
} from "../lib/examples/api";

interface ExampleDataToggleProps {
  onChanged: () => void;
}

type ToggleStatus = "loading" | "seeded" | "removed" | "error";

export function ExampleDataToggle({ onChanged }: ExampleDataToggleProps) {
  const { workspaceId } = useWorkspace();
  const [status, setStatus] = useState<ToggleStatus>("loading");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getExampleState(workspaceId)
      .then((s) => {
        if (!cancelled) setStatus(s.state === "seeded" ? "seeded" : "removed");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const doAdd = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await seedExampleData(workspaceId);
      setStatus("seeded");
      onChanged();
    } catch {
      setActionError("Couldn't add example data. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [workspaceId, onChanged]);

  const doRemove = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      await removeExampleData(workspaceId);
      setStatus("removed");
      setConfirming(false);
      onChanged();
    } catch {
      setActionError("Couldn't remove example data. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [workspaceId, onChanged]);

  // Never fall through to an enabled "Add" (a destructive clean-slate reseed)
  // when the state is unknown — that could delete edited example copies.
  if (status === "loading" || status === "error") return null;

  return (
    <Flex align="center" gap={2}>
      {actionError && (
        <Text fontSize="xs" color="red.600" role="alert">
          {actionError}
        </Text>
      )}
      {status === "seeded" ? (
        <Button
          size="sm"
          variant="outline"
          borderColor="brand.border"
          color="brand.brown"
          loading={busy}
          onClick={() => setConfirming(true)}
        >
          <Trash size={14} /> Remove example data
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          borderColor="brand.border"
          color="brand.brown"
          loading={busy}
          onClick={doAdd}
        >
          <Plus size={14} /> Add example data
        </Button>
      )}

      <DialogRoot
        open={confirming}
        onOpenChange={(e) => setConfirming(e.open)}
        role="alertdialog"
      >
        <Portal>
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Remove example data?</DialogTitle>
              </DialogHeader>
              <DialogBody>
                <Text fontSize="sm" color="gray.600">
                  This deletes all example datasets, connections, and stories
                  from this workspace, including any edits you made to them. You
                  can add them back later.
                </Text>
              </DialogBody>
              <DialogFooter>
                <Flex gap={2}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirming(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    bg="brand.orange"
                    color="white"
                    _hover={{ bg: "brand.orangeHover" }}
                    loading={busy}
                    onClick={doRemove}
                  >
                    Remove
                  </Button>
                </Flex>
              </DialogFooter>
            </DialogContent>
          </DialogPositioner>
        </Portal>
      </DialogRoot>
    </Flex>
  );
}
