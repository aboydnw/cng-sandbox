import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { ShareNetwork } from "@phosphor-icons/react";
import { ShareDialog } from "./ShareDialog";

interface ShareButtonProps {
  kind: "dataset" | "connection";
  resourceId: string;
  isShared: boolean;
  onSharedChange(newValue: boolean): void;
  isExample?: boolean;
}

export function ShareButton({
  kind,
  resourceId,
  isShared,
  onSharedChange,
  isExample = false,
}: ShareButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const showSharedView = isShared || isExample;

  return (
    <>
      <Button
        bg={showSharedView ? "brand.bgSubtle" : "brand.orange"}
        color={showSharedView ? "brand.orange" : "white"}
        borderWidth={showSharedView ? "1px" : undefined}
        borderColor={showSharedView ? "brand.border" : undefined}
        size="sm"
        fontWeight={600}
        borderRadius="4px"
        _hover={{ bg: showSharedView ? "brand.border" : "brand.orangeHover" }}
        onClick={() => setDialogOpen(true)}
        px={4}
      >
        <ShareNetwork size={14} weight="bold" />
        {showSharedView ? "Shared" : "Share"}
      </Button>
      <ShareDialog
        kind={kind}
        resourceId={resourceId}
        isShared={isShared}
        isExample={isExample}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSharedChange={onSharedChange}
      />
    </>
  );
}
