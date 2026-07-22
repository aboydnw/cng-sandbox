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
      bg={error ? "red.500" : "white"}
      color={error ? "white" : "brand.brown"}
      borderRadius="control"
      borderWidth="1px"
      borderColor={error ? "status.danger.fg" : "border.subtle"}
      shadow="md"
      _hover={{ bg: error ? "red.500" : "brand.bgSubtle" }}
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
