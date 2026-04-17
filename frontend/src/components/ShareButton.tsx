import { useState } from "react";
import { Button } from "@chakra-ui/react";
import { ShareNetwork } from "@phosphor-icons/react";
import { ShareDialog } from "./ShareDialog";

interface ShareButtonProps {
  kind: "dataset" | "connection";
  resourceId: string;
  isShared: boolean;
  onSharedChange(newValue: boolean): void;
}

export function ShareButton({
  kind,
  resourceId,
  isShared,
  onSharedChange,
}: ShareButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        bg={isShared ? "brand.bgSubtle" : "brand.orange"}
        color={isShared ? "brand.orange" : "white"}
        borderWidth={isShared ? "1px" : undefined}
        borderColor={isShared ? "brand.border" : undefined}
        size="sm"
        fontWeight={600}
        borderRadius="4px"
        _hover={{ bg: isShared ? "brand.border" : "brand.orangeHover" }}
        onClick={() => setDialogOpen(true)}
        px={4}
      >
        <ShareNetwork size={14} weight="bold" />
        {isShared ? "Shared" : "Share"}
      </Button>
      <ShareDialog
        kind={kind}
        resourceId={resourceId}
        isShared={isShared}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSharedChange={onSharedChange}
      />
    </>
  );
}
