import { Button, Flex, IconButton, Text } from "@chakra-ui/react";
import { MagnifyingGlassPlus, X } from "@phosphor-icons/react";

export interface ZoomPromptBannerProps {
  minZoom: number;
  onZoomToData: () => void;
  onDismiss: () => void;
}

/**
 * Dismissible overlay shown when the camera is below the layer's min zoom,
 * prompting the user to zoom in far enough for tiles to load.
 */
export function ZoomPromptBanner({
  minZoom,
  onZoomToData,
  onDismiss,
}: ZoomPromptBannerProps) {
  return (
    <Flex
      position="absolute"
      top={3}
      left="50%"
      transform="translateX(-50%)"
      zIndex={10}
      bg="white"
      borderWidth="1px"
      borderColor="brand.border"
      borderRadius="8px"
      shadow="md"
      px={3}
      py={2}
      align="center"
      gap={2}
      role="status"
    >
      <MagnifyingGlassPlus size={16} color="#CF3F02" weight="bold" />
      <Text fontSize="sm" color="brand.brown" whiteSpace="nowrap">
        Zoom in to level {minZoom} to see data
      </Text>
      <Button
        size="xs"
        bg="brand.orange"
        color="white"
        _hover={{ bg: "brand.orangeHover" }}
        onClick={onZoomToData}
      >
        Zoom to data
      </Button>
      <IconButton
        aria-label="Dismiss zoom prompt"
        title="Dismiss"
        size="xs"
        variant="ghost"
        color="brand.brown"
        _hover={{ bg: "brand.bgSubtle" }}
        onClick={onDismiss}
      >
        <X size={14} />
      </IconButton>
    </Flex>
  );
}
