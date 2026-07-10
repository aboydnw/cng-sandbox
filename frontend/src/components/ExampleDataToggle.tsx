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

export function ExampleDataToggle({ onChanged }: ExampleDataToggleProps) {
  const { workspaceId } = useWorkspace();
  const [seeded, setSeeded] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getExampleState(workspaceId)
      .then((s) => {
        if (!cancelled) setSeeded(s.state === "seeded");
      })
      .catch(() => {
        if (!cancelled) setSeeded(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const doAdd = useCallback(async () => {
    setBusy(true);
    try {
      await seedExampleData(workspaceId);
      setSeeded(true);
      onChanged();
    } finally {
      setBusy(false);
    }
  }, [workspaceId, onChanged]);

  const doRemove = useCallback(async () => {
    setBusy(true);
    try {
      await removeExampleData(workspaceId);
      setSeeded(false);
      setConfirming(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }, [workspaceId, onChanged]);

  if (seeded === null) return null;

  return (
    <>
      {seeded ? (
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
    </>
  );
}
