import { useState, useCallback } from "react";
import { Box, Text } from "@chakra-ui/react";
import { X } from "@phosphor-icons/react";

interface PopupInfo {
  x: number;
  y: number;
  properties: Record<string, unknown>;
}

export function useVectorPopup() {
  const [popup, setPopup] = useState<PopupInfo | null>(null);

  const onClick = useCallback((info: any) => {
    if (!info.object) {
      setPopup(null);
      return;
    }
    const properties = info.object.properties ?? info.object;
    setPopup({
      x: info.x,
      y: info.y,
      properties,
    });
  }, []);

  const dismiss = useCallback(() => setPopup(null), []);

  return { popup, onClick, dismiss };
}

interface VectorPopupOverlayProps {
  popup: PopupInfo;
  onDismiss: () => void;
}

export function VectorPopupOverlay({ popup, onDismiss }: VectorPopupOverlayProps) {
  return (
    <Box
      position="absolute"
      left={`${popup.x}px`}
      top={`${popup.y}px`}
      bg="white"
      borderRadius="6px"
      shadow="lg"
      border="1px solid"
      borderColor="gray.200"
      p={3}
      maxW="300px"
      maxH="400px"
      overflow="auto"
      zIndex={10}
      onClick={(e) => e.stopPropagation()}
    >
      <Box
        as="button"
        position="absolute"
        top={1}
        right={1}
        fontSize="xs"
        color="gray.400"
        onClick={onDismiss}
        cursor="pointer"
        bg="none"
        border="none"
        p={1}
      >
        <X size={14} />
      </Box>
      {Object.entries(popup.properties).map(([k, v]) => (
        <Box key={k} mb={1}>
          <Text as="span" fontSize="xs" fontWeight={600} color="gray.600">
            {k}:{" "}
          </Text>
          <Text as="span" fontSize="xs" color="gray.800">
            {String(v)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
