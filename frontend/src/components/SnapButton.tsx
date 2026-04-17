import { IconButton, Spinner } from "@chakra-ui/react";
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
      borderRadius="4px"
      shadow="sm"
      _hover={{ bg: error ? "red.500" : "brand.bgSubtle" }}
      onClick={onSnap}
      disabled={isCapturing}
    >
      {isCapturing ? <Spinner size="sm" /> : <Camera size={18} weight="regular" />}
    </IconButton>
  );
}
