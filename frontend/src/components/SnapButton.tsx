import { IconButton } from "@chakra-ui/react";
import { BrandSpinner } from "./ui/BrandSpinner";
import { Camera } from "@phosphor-icons/react";

interface SnapButtonProps {
  onSnap: () => void;
  isCapturing: boolean;
  error: boolean;
}

export function SnapButton({ onSnap, isCapturing, error }: SnapButtonProps) {
  return (
    <IconButton
      aria-label="Save map as PNG"
      title="Save map as PNG"
      size="sm"
      bg={error ? "status.danger.fg" : "bg.raised"}
      color={error ? "action.onPrimary" : "fg"}
      borderRadius="control"
      borderWidth="1px"
      borderColor={error ? "status.danger.fg" : "border.subtle"}
      shadow="md"
      _hover={{
        bg: error ? "status.danger.hover" : "bg.subtle",
        borderColor: error ? "status.danger.hover" : "border.emphasized",
      }}
      onClick={onSnap}
      disabled={isCapturing}
    >
      {isCapturing ? (
        <BrandSpinner size={18} />
      ) : (
        <Camera size={18} weight="regular" />
      )}
    </IconButton>
  );
}
