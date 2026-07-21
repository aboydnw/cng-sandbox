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

  const onClick = useCallback(
    (info: {
      object?: { properties?: Record<string, unknown> } & Record<
        string,
        unknown
      >;
      x: number;
      y: number;
    }) => {
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
    },
    []
  );

  const dismiss = useCallback(() => setPopup(null), []);

  return { popup, onClick, dismiss };
}

interface VectorPopupOverlayProps {
  popup: PopupInfo;
  onDismiss: () => void;
}

export function VectorPopupOverlay({
  popup,
  onDismiss,
}: VectorPopupOverlayProps) {
  return (
    <Box
      position="absolute"
      left={`${popup.x}px`}
      top={`${popup.y}px`}
      transform="translate(-8px, -8px)"
      bg="bg.raised"
      borderRadius="panel"
      shadow="lg"
      border="1px solid"
      borderColor="map.controlBorder"
      p={3}
      w="min(300px, calc(100vw - 24px))"
      maxH="min(400px, calc(100vh - 24px))"
      overflow="auto"
      zIndex={10}
      onClick={(e) => e.stopPropagation()}
      role="region"
      aria-label="Selected feature details"
    >
      <Box
        as="button"
        aria-label="Close feature details"
        position="absolute"
        top={1}
        right={1}
        fontSize="xs"
        color="fg.muted"
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
          <Text as="span" fontSize="xs" fontWeight={600} color="fg.muted">
            {k}:{" "}
          </Text>
          <Text as="span" fontSize="xs" color="fg">
            {String(v)}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
